import json
import boto3
from botocore.config import Config
import requests

def search_stocks(
    query: str,
    lang: str = "en-US",
    region: str = "US",
    enable_fuzzy_query: bool = False,
    quotes_query_id: str = "tss_match_phrase_query",
    multi_quote_query_id: str = "multi_quote_single_token_query",
    news_query_id: str = "news_cie_vespa",
    enable_cb: bool = False,
    enable_nav_links: bool = True,
    enable_enhanced_trivial_query: bool = True,
    enable_research_reports: bool = True,
    enable_cultural_assets: bool = True,
    enable_logo_url: bool = True,
    enable_lists: bool = False,
    recommend_count: int = 5,
    enable_ccc_boost: bool = True,
    enable_private_company: bool = True
):

    url = "https://query1.finance.yahoo.com/v1/finance/search"

    params = {
        "q": query,
        "lang": lang,
        "region": region,
        "enableFuzzyQuery": str(enable_fuzzy_query).lower(),
        "quotesQueryId": quotes_query_id,
        "multiQuoteQueryId": multi_quote_query_id,
        "newsQueryId": news_query_id,
        "enableCb": str(enable_cb).lower(),
        "enableNavLinks": str(enable_nav_links).lower(),
        "enableEnhancedTrivialQuery": str(enable_enhanced_trivial_query).lower(),
        "enableResearchReports": str(enable_research_reports).lower(),
        "enableCulturalAssets": str(enable_cultural_assets).lower(),
        "enableLogoUrl": str(enable_logo_url).lower(),
        "enableLists": str(enable_lists).lower(),
        "recommendCount": recommend_count,
        "enableCccBoost": str(enable_ccc_boost).lower(),
        "enablePrivateCompany": str(enable_private_company).lower(),
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/125.0.0.0 Safari/537.36"
    }

    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()

    data = response.json()

    results = []
    for item in data.get("quotes", []):
        if item.get('quoteType') == 'EQUITY':
            results.append({
                "exchange": item.get("exchange"),
                "symbol": item.get("symbol"),
                "shortname": item.get("shortname"),
                "sector": item.get("sector"),
                "longname": item.get("longname"),
                "quote_type": item.get("quoteType"),
                "score": item.get("score"),
            })

    return results



def lambda_handler(event, context):
    print("Event: ", event)

    query_parameters = event.get('queryStringParameters')
    if not query_parameters:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing query parameters')
        }

    if "/search" in event.get('rawPath'):
        _q = query_parameters.get('_q')
        search_results = search_stocks(query=_q)

        return {
            "statusCode": 200,
            "message": "Success",
            "body": json.dumps(search_results)
        }

    else:

        boto_config = Config(
            connect_timeout=10,
            read_timeout=900,
            retries={"max_attempts": 1, "mode": "standard"}
        )

        client = boto3.client('bedrock-agentcore', region_name='us-east-1', config=boto_config)

        payload = json.dumps({
            "stock_name": query_parameters.get('stockname'),
            "ticker_symbol": query_parameters.get('ticker_symbol'),
            "actor_id": query_parameters.get('actor_id')
        })

        response = client.invoke_agent_runtime(
            agentRuntimeArn='',
            runtimeSessionId='',  # Must be 33+ chars
            payload=payload,
            qualifier="DEFAULT"  # Optional
        )

        if "text/event-stream" in response.get("contentType", ""):
            content = []
            for line in response["response"].iter_lines(chunk_size=1):
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        line = line[6:]
                        content.append(line)

            return json.dumps({
                "statusCode": 200,
                "message": "Success",
                "response": content if content else None
            })

        elif response.get("contentType") == "application/json":
            # Handle standard JSON response
            content = []
            for chunk in response.get("response", []):
                content.append(chunk.decode('utf-8'))

            return json.dumps({
                "statusCode": 200,
                "message": "Success",
                "response": content if content else None
            })

        else:
            # Print raw response for other content types
            print(json.loads(response))

            return json.dumps({
                "statusCode": 200,
                "message": "Success",
                "response": json.dumps(response)
            })