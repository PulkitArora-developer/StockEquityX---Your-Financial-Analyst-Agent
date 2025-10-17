import json
import os
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.memory import MemoryClient
from ddgs import DDGS
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from botocore.config import Config as BotocoreConfig
import uuid
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("financial-agent")

app = BedrockAgentCoreApp()

region = os.environ.get('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
SESSION_ID = "financial_agent_analysis_session"
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID")

boto_config = BotocoreConfig(
    retries={"max_attempts": 1, "mode": "standard"},
    connect_timeout=5,
    read_timeout=900
)

model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=region,
    boto_client_config=boto_config
)

memory_client = MemoryClient(region_name=region)

s3_client = boto3.client("s3", region_name=region)


def upload_to_s3(file_path, bucket_name, s3_key_upload):
    try:
        s3_client.upload_file(
            file_path,
            bucket_name,
            s3_key_upload,
        )
        logger.info(f"✅ Successfully uploaded '{file_path}' to 's3://{bucket_name}/{s3_key_upload}'")
        return True
    except FileNotFoundError:
        logger.info("❌ The file was not found.")
        return False
    except NoCredentialsError:
        logger.info("❌ AWS credentials not available.")
        return False
    except ClientError as e:
        logger.info(f"❌ Client error: {e}")
        return False


class MemoryInstance:

    def __init__(self):
        self.memory_name = "FinanceAgentMemory"

    def list_memory_instances(self):
        memories_data = memory_client.list_memories()
        memory_data = []
        if memories_data:
            memory_data = [memory for memory in memories_data if memory.get('id').startswith(self.memory_name)]

        if memory_data:
            memory_id = memory_data[0].get('memoryId')
            return memory_id
        else:
            return None

    def create_memory_instance(self):
        try:
            # Create memory resource without strategies (thus only access to short-term memory)
            memory = memory_client.create_memory_and_wait(
                name=self.memory_name,
                strategies=[],
                description="Memory for financial agent to keep user past interactions",
                event_expiry_days=30,
            )
            memory_id = memory['id']

            return memory_id
        except Exception as e:
            logger.info(f"❌ ERROR while creating Memory: {e}")
            return None

    def delete_memory_instance(self, memory_id):
        if memory_id:
            try:
                memory_client.delete_memory_and_wait(memory_id=memory_id)
                return True
            except Exception as e:
                logger.info("❌ ERROR while deleting memory: ", e)
                return False

        return True

    def save_data_memory(self, memory_id, share_name, ACTOR_ID):
        try:

            current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            memory_client.create_event(
                memory_id=memory_id,
                actor_id=ACTOR_ID,
                session_id=SESSION_ID,
                messages=[(f"Interaction At: {current_datetime} (UTC) \n\n Stock Name: {share_name}",
                           "assistant")]
            )
            logger.info("✅ Summary data saved to memory successfully.")
        except Exception as e:
            logger.info(f"⚠️ Could not save summary to memory: {e}")

    def retrieve_memory(self, ACTOR_ID, SESSION_ID, memory_id):
        try:
            # Get session info from agent state

            if not ACTOR_ID or not SESSION_ID:
                logger.info("Missing actor_id or session_id in agent state")
                return

            # Load the last 5 conversation turns from memory
            recent_turns = memory_client.get_last_k_turns(
                memory_id=memory_id,
                actor_id=ACTOR_ID,
                session_id=SESSION_ID,
                k=5,
                max_results=5
            )

            if recent_turns:
                # Format conversation history for context
                context_messages = []
                for turn in recent_turns:
                    for index, message in enumerate(turn):
                        content = message['content']['text']
                        context_messages.append(f"{index + 1}) {content}")

                # context = "\n".join(context_messages)
                logger.info(f"✅ Loaded {len(recent_turns)} conversation turns")
                return f"\n\nRecent conversation:\n{context_messages}"

        except Exception as e:
            logger.info(f"Memory load error: {e}")


@tool
def get_previous_months_stock_data(ticker_symbol):
    """
    Fetches last 3 months of daily stock data (Open, High, Low, Close, Volume)
    using Yahoo Finance.
    """

    # Define time range
    end_date = datetime.today()
    start_date = end_date - timedelta(days=90)

    # Fetch data
    data = yf.download(ticker_symbol, start=start_date, end=end_date, interval="1d")

    if data.empty:
        logger.info(f"No data found for {ticker_symbol}")
        return None

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]

    # Reset index to make 'Date' a column
    data.reset_index(inplace=True)

    # Keep only useful columns
    data = data[["Date", "Open", "High", "Low", "Close", "Volume"]]

    # Convert Timestamp to ISO string (for JSON)
    data["Date"] = data["Date"].astype(str)

    # Convert to JSON (list of dicts)
    json_data = data.to_dict(orient="records")

    return json_data


def current_price_bedrock_agent(ticker_symbol):
    """
    Fetches the current stock price and related info for the given ticker using Yahoo Finance.
    """

    try:
        # Fetch stock info
        stock = yf.Ticker(ticker_symbol)

        stock_info = stock.info

        # Current price and currency
        price = stock_info.get("regularMarketPrice")
        currency = stock_info.get("currency", "USD")

        # Price change percentage
        change_percent = stock_info.get("regularMarketChangePercent")

        # Ticker symbol
        symbol = stock_info.get("symbol", ticker_symbol)

        # Timestamp in UTC
        timestamp = datetime.utcnow().isoformat()

        # Prepare JSON output
        result = {
            "symbol": symbol,
            "price": float(price) if price else None,
            "currency": currency,
            "change_percent": float(change_percent) if change_percent else 0.0,
            "timestamp": timestamp,
            "52WeekChange": stock_info.get('52WeekChange'),
            "allTimeHigh": stock_info.get('allTimeHigh'),
            "allTimeLow": stock_info.get('allTimeLow'),
            "averageVolume": stock_info.get('averageVolume'),
            "dayHigh": stock_info.get('dayHigh'),
            "dayLow": stock_info.get('dayLow'),
            "marketCap": stock_info.get('marketCap'),
            "quoteType": stock_info.get('quoteType'),
            "sector": stock_info.get('sector'),
            "targetHighPrice": stock_info.get('targetHighPrice'),
            "targetLowPrice": stock_info.get('targetLowPrice'),
            "targetMeanPrice": stock_info.get('targetMeanPrice'),
            "targetMedianPrice": stock_info.get('targetMedianPrice'),
            "website": stock_info.get('website'),
        }

        return result, f"{price} {currency}" if price else None

    except Exception as e:
        logger.info(f"Error fetching current price for {ticker_symbol}: {e}")
        return None, None


def performance_bedrock_agent(ticker_symbol, result):
    recent_news_sentiment = result.get('stock_related_news')
    current_price_metrics = result.get('stock_information')
    company_business_model = result.get('company_business_model_data')

    current_price = current_price_metrics.get('stock_current_price')

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    performance_agent = Agent(
        name="Performance Analysis Agent",
        model=model,
        callback_handler=None,
        tools=[get_previous_months_stock_data],
        system_prompt=f"""
            You are a financial market analysis agent. Your role is to provide a analysis of recent stock prices
            and give a **Buy / Sell / Hold recommendation** based on the last 3 months of stock data.

            You have access to the tool **get_previous_months_stock_data(ticker_symbol)**, which returns the last 3 months
            of daily stock price data with the fields:
                - Date (YYYY-MM-DD)
                - Open
                - High
                - Low
                - Close
                - Volume

            ### Tasks:

            1. **Fetch Data**
                Note: **Today Date and Time:** {current_datetime} (UTC).
               - Use the tool to retrieve the last 3 months of stock prices for ({ticker_symbol}).
               - Analyse Current stock price and key metrics provided below.  
               - Company business model summary provided below.
               - Recent news sentiment provided below.
               

            2. **Analyze Trend**
               - Determine the overall trend direction based on closing prices:
                 - "up" → consistent increase
                 - "down" → consistent decrease
                 - "flat" → minimal net change
               - Consider intermediate fluctuations when assessing trend stability.

            3. **Calculate Percent Change**
               - Calculate percentage change between first and last closing prices:
                 ```
                 percent_change = ((last_close - first_close) / first_close) * 100
                 ```
               - Round to 2 decimal places.

            4. **Calculate Volatility Index**
               - Estimate normalized volatility (0.0 = very stable, 1.0 = highly volatile) based on daily price swings.
               - Round to 2 decimal places.

            5. **Generate Recommendation**
               - Buy → upward trend, moderate change, low-medium volatility, positive news/business outlook  
               - Sell → downward trend or high volatility with losses, negative news/business signals  
               - Hold → flat trend, small change, moderate volatility, mixed or neutral sentiment  
               - Provide a concise 1–2 line reasoning explaining your recommendation.

            ### Response Format
                Write a **concise professional summary**.  
                Use this tone and structure:

                Stock: {ticker_symbol}  
                Trend: <up / down / flat>  
                3-Month Change: <+X% or -X%>  
                Volatility: <low / medium / high>  
                Recommendation: <Buy / Sell / Hold>  
                Reasoning: <clear lines summarizing why>  

                If data is insufficient, write:
                "Insufficient data available to provide a meaningful analysis or recommendation for {ticker_symbol}

            ### Rules
            - Use only the data returned by `get_previous_months_stock_data`.
            - Do not fetch external data or guess prices.
            - Round all numeric values to 2 decimal places.
            - Keep 'comment' concise, max 500 words.

            Here is the Data:

            **Current stock price:** 
            {current_price} \n

            **Key Metrics:** 
            {current_price_metrics} \n

            **Company business model:** 
            {company_business_model} \n

            **Recent news sentiment:** 
            {recent_news_sentiment} \n

        """
    )

    response = None
    try:
        response = performance_agent(ticker_symbol)
    except Exception as e:
        logger.info(e)

    if response:
        return response.message.get('content')[0].get('text')
    else:
        return None


@tool
def duck_duck_go_search(keywords):
    results = DDGS().text(keywords, region='us-en', max_results=25)
    return results


def news_agent_bedrock(share_name):

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    news_agent = Agent(
        name="News Fetching Agent",
        model=model,
        tools=[duck_duck_go_search],
        system_prompt=f"""
                You are a financial market sentiment analysis agent.

                Use the **DuckDuckGo search tool** to find the most recent 10–15 verified English-language news headlines 
                related to the company **{share_name}** from reputable financial sources such as:
                MoneyControl, Economic Times, Mint, Upstox, CNBC TV18, Times of India.

                Note: **Today Date and Time:** {current_datetime} (UTC).

                ### How to search:
                - Generate a precise query for the DuckDuckGo search tool in this format:
                  "<company name> stock news
                - Focus only on financial and investor-related articles (ignore general news).
                - Extract the headline text (not URLs).
                - Find recent articles based on Today Date.

                ### Your tasks:
                1. Fetch and analyze the most recent verified headlines mentioning {share_name}.
                2. Perform sentiment analysis for each headline:
                    - Positive → optimistic tone, growth, profits, upgrades, or favorable performance.
                    - Negative → losses, layoffs, downgrades, scandals, or poor performance.
                    - Neutral → factual, mixed, or inconclusive tone.
                3. Determine the overall market sentiment based on majority tone.

                ### Response Format
                <Write a concise paragraph summarizing the general market sentiment, mentioning whether investors are optimistic, cautious, or concerned, and why.>

                ### Rules:
                - Always use the DuckDuckGo search tool — do NOT make up headlines.
                - Include only relevant financial or investor-related headlines.
                - Limit to concise, English-language results (max 25).
                - Keep 'summary' under 500 words, summarizing the general market sentiment, mentioning whether investors are optimistic, cautious, or concerned, and why.
            """
    )

    response = None
    try:
        response = news_agent(share_name)
    except Exception as e:
        logger.info(e)

    if response:
        return response.message.get('content')[0].get('text')
    else:
        return None


def business_model_agent_bedrock(share_name):

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    business_model_agent = Agent(
        name="Business Model Analysis Agent",
        model=model,
        callback_handler=None,
        tools=[duck_duck_go_search],
        system_prompt=f"""
                You are a financial research agent. Your task is to summarize the **business model**
                of the company **{share_name}**.

                ### Instructions:
                1. Use the **DuckDuckGo search tool** to find recent and relevant information about the company’s business model.
                   - Generate precise queries for the tool, e.g., 
                     "{share_name} business model.
                2. Focus on reliable sources: Forbes, Investopedia, Reuters, Bloomberg, Yahoo Finance, Wikipedia or the company's own website.
                3. Extract key details, including:
                   - How the company generates revenue
                   - Main products or services
                   - Key customer segments
                   - Any additional monetization channels
                   - Are they innovative, competitive, or in decline?
                   - Experienced, trustworthy, and transparent?

                4. Note: **Today Date and Time:** {current_datetime} (UTC). Find recent information accordingly.


                ### Output Format:
                Return your findings:
                  business_model_summary: "<concise summary of how the company makes money, products/services, and revenue streams>"

                ### Rules:
                - Generate clear, concise, and factual summaries.
                - Only use information from credible sources.
                - Do not include commentary or personal opinion.
                - Output valid JSON only, without extra text or markdown.
            """
    )

    response = None

    try:
        response = business_model_agent(share_name)
    except Exception as e:
        logger.info(e)

    if response:
        return response.message.get('content')[0].get('text')
    else:
        return None


def report_generator_agent(master_agent_result, summarise_agent, past_interactions, stock_current_price):
    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    report_agent = Agent(
        name="Financial Report Generator Agent",
        model=model,
        tools=[],
        system_prompt=f"""
        You are a **Financial Report Generation Agent**.  
        Your task is to generate a **self-contained HTML snippet** that presents a **simple financial report** for a given stock using the provided input data.

        ---

        ### INPUT DATA:

        You will receive the following inputs:

        1. **master_agent_result** — an object with these keys:
           - **stock_information** → full stock info including current price, metadata, and key ratios  
           - **stock_current_price** → latest stock price as a float  
           - **stock_performance** → includes trend, volatility, percent change, and Buy/Sell/Hold recommendation  
           - **company_business_model_data** → concise summary of the company's business model  
           - **stock_related_news** → top headlines and overall sentiment  

        2. **summarise_agent** — a summarized narrative generated from `master_agent_result`.  
           Include this section verbatim in the final HTML report.

        3. **past_interactions** — a short record of the user’s previous financial interactions and data.  
           Display this as a **separate section** in the report under the title:
           **“📜 Last 5 Interactions”**.

           Create a table for this section with columns:
           - Interaction At  
           - Stock Name  

           Notes:  
           - Do **not** modify or rephrase any interaction text.  
           - Do **not** repeat interactions.  
           - The list will contain up to 5 entries.  

        ---

        ### GOAL:

        Generate an **HTML report** that:

        1. Reads and formats all data from `master_agent_result`.
        2. Presents a **clear, human-readable summary**, including:
           - Current stock price and % change  
           - Trend and volatility  
           - Key highlights of the business model  
           - News sentiment summary  
           - Final Buy / Hold / Sell recommendation with reasoning  
        3. Renders this as a **complete HTML structure** (`report.html`) with:
           - Clean and organized layout  
           - Proper headings and readable typography  
           - Minimal inline **CSS styling** for readability  
           - **Dark mode** implementation via CSS  
           - (Optional) Basic visual elements such as line charts, bar charts, or pie charts — **only using HTML and CSS**, no external libraries or scripts  
           - Adequate spacing between sections and visual elements  

        ---

        ### ADDITIONAL REQUIREMENTS:

        - Include **today’s date and time** in the header:  
          **Report Generated on:** {current_datetime} (UTC)

        - Display **Current Price of the Stock:** {stock_current_price}

        - Always include a **disclaimer at the end** of the report:

          🔒 *This report is generated using advanced AI analysis • For informational purposes only • Not financial advice.*

        ---

        ### PROVIDED DATA:

        **Master Agent Result:**  
        {master_agent_result}

        **Summary Agent Result:**  
        {summarise_agent}

        **Past Interactions:**  
        {past_interactions}

        ---

        ### OUTPUT INSTRUCTION:

        Return **only** the complete HTML code for the financial report.  
        Return **only raw HTML** (without markdown code fences, triple backticks, or explanations).  
        Do **not** include any explanations, markdown formatting, or additional commentary outside the HTML.
        """
    )

    response = None
    try:
        response = report_agent(str(master_agent_result))
    except Exception as e:
        logger.info(e)

    if response:
        return response.message.get('content')[0].get('text')
    else:
        return None


def summariser_agent(master_agent_result):
    summarise_agent = Agent(
        name="Financial Report Summariser Agent",
        model=model,
        tools=[],
        system_prompt=f"""
            You are a **Financial Report Summariser Agent**.  
            Your primary objective is to **summarise the complete stock analysis provided in `master_agent_result`** into a structured, insightful, and timestamped narrative that captures all key aspects of the company’s recent market performance and sentiment.

            ### 🎯 PURPOSE
            The summary should be clear enough for a portfolio manager or financial analyst to quickly understand:
            - What happened with the stock recently,
            - Why it happened (context from business model and news),
            - What the current market sentiment is,
            - What the suggested investment stance is (Buy / Hold / Sell),
            - And at **what date/time** this snapshot of analysis was generated.

            ### 🧩 INPUT DATA
            You will receive a dictionary called **`master_agent_result`**, which contains:
            - `stock_information`: Detailed metadata about the stock (price, change %, volume, ratios, etc.)
            - `stock_current_price`: The latest price as a float
            - `stock_performance`: Trend, volatility, % change, and recommendation
            - `company_business_model_data`: Concise overview of how the company makes money
            - `stock_related_news`: Headlines and sentiment extracted from reliable financial sources

            ### 🧠 YOUR TASK
            Generate a **comprehensive summary (300–400 words)** that:
            1. Starts with the **date and time** of analysis (use current date/time if not provided).  
               Example: *“As of October 14, 2025, Tata Motors Ltd was trading at ₹395.45...”*
            2. Provides a **cohesive narrative** integrating:
               - Stock’s **current price**, **daily % change**, and **market trend**
               - **Volatility index** and what it suggests about investor sentiment
               - Summary of the **business model** — how the company generates revenue and its key segments
               - **Recent news sentiment** (positive, negative, or neutral) and why the market feels that way
               - The final **Buy / Hold / Sell recommendation** and a brief rationale
            3. Mentions **any important corporate events** (splits, demergers, etc.) that explain recent price movements
            4. Keeps tone **analytical, factual, and professional**, avoiding speculation
            5. Includes **numeric details** where useful (rounded to 2 decimals)
            6. Should read naturally like a human analyst’s note (not a list or JSON)
            7. Avoid any markdown, code formatting, or technical syntax — only clean paragraph-style text.

            ### 🧾 OUTPUT FORMAT
            Produce **plain text output only** — a single, well-structured 300–400 word summary.  
            The summary must end with a brief **overall investment stance** sentence such as:  
            > “Given the current fundamentals, sentiment, and technicals, the recommendation remains: Hold.”

            ### 🧱 INPUT DATA TO SUMMARISE:
            {master_agent_result}
            """
    )

    response = None
    try:
        response = summarise_agent(str(master_agent_result))
    except Exception as e:
        logger.info(e)

    if response:
        return response.message.get('content')[0].get('text')
    else:
        return None


class MasterAgent(Agent):

    def __init__(self):
        super().__init__(name="MasterAgent")

    def run(self, share_name, ticker_symbol, ACTOR_ID):
        """
        Run all sub-agents sequentially (synchronously).
        """

        memory_obj = MemoryInstance()

        memory_id = memory_obj.list_memory_instances()

        try:

            if not memory_id:
                # Initialise Memory
                memory_id = memory_obj.create_memory_instance()

            tasks = {
                "stock_info_task": lambda: current_price_bedrock_agent(ticker_symbol=ticker_symbol),
                "business_model_task": lambda: business_model_agent_bedrock(share_name=share_name),
                "news_task": lambda: news_agent_bedrock(share_name=share_name)
            }

            results = {}
            with ThreadPoolExecutor(max_workers=3) as executor:
                # Start all tasks in parallel
                future_to_task = {executor.submit(fn): name for name, fn in tasks.items()}

                for future in as_completed(future_to_task):
                    task_name = future_to_task[future]
                    try:
                        result = future.result()

                        if task_name == "stock_info_task":
                            stock_info, current_price = result
                            results["stock_information"] = stock_info
                            results["stock_current_price"] = current_price
                            logger.info(f"✅ {task_name} done")

                        elif task_name == "business_model_task":
                            results["company_business_model_data"] = result
                            logger.info(f"✅ {task_name} done")

                        elif task_name == "news_task":
                            results["stock_related_news"] = result
                            logger.info(f"✅ {task_name} done")

                    except Exception as e:
                        logger.info(f"❌ Error in {task_name}: {e}")

            logger.info(f"\n🔹 Running Performance Agent...")
            stock_performance = performance_bedrock_agent(ticker_symbol=ticker_symbol, result=results)
            results["stock_performance"] = stock_performance

            logger.info(f"\n🔹 Running Summariser Agent...")
            summarise_agent = summariser_agent(result)

            # Previous Memory Interactions
            past_interactions = memory_obj.retrieve_memory(ACTOR_ID, SESSION_ID, memory_id)

            # Save Data into Memory
            memory_obj.save_data_memory(memory_id, share_name, ACTOR_ID)

            report_generation_html_code = report_generator_agent(result, summarise_agent, past_interactions, results["stock_current_price"])

            presigned_url = None
            if report_generation_html_code:
                file_name = f"{share_name}_report_" + str(uuid.uuid4()) + ".html"
                file_path = f"/tmp/{file_name}"

                with open(file_path, "w") as file:
                    file.write(report_generation_html_code)

                if os.path.exists(file_path):
                    s3_upload_path = f"analysis-result-{share_name}-{ticker_symbol}/{file_name}"
                    upload_to_s3(file_path, S3_BUCKET_NAME, s3_upload_path)

                    presigned_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': S3_BUCKET_NAME,
                            'Key': s3_upload_path
                        },
                        ExpiresIn=21600
                    )

            print("Output: ", {"summary": summarise_agent, "report": presigned_url})

            return {"summary": summarise_agent, "report": presigned_url}

        except Exception as e:
            logger.info(e)

        finally:
            try:
                if os.path.exists(file_name):
                    os.remove(file_name)
            except Exception as e:
                pass

            # In Case of Delete Memory

            # try:
            #     memory_obj.delete_memory_instance(memory_id)
            # except Exception as e:
            #     logger.info("Error while deleting Memory: ", e)


@app.entrypoint
def strands_agent_bedrock(payload):
    """
    Invoke the agent with a payload
    """

    try:

        logger.info(f"Payload Recieved: {payload}")

        if isinstance(payload, str):
            payload = json.loads(payload)

        stock_name = payload.get("stock_name")
        ticker_symbol = payload.get("ticker_symbol")
        ACTOR_ID = payload.get("actor_id")

        logger.info(f"User input: Stock Name: {stock_name}, Ticker Symbol: {ticker_symbol}")

        master_agent = MasterAgent()

        response = master_agent.run(stock_name, ticker_symbol=ticker_symbol, ACTOR_ID=ACTOR_ID)

        logger.info(f"Response Completed")

        return response

    except Exception as e:
        logger.error(f"Exception: {e}")
        logger.error(f"Response Failed")

        return {}


if __name__ == "__main__":
    app.run()
