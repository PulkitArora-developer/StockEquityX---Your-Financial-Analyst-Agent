import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { environment } from "../environments/environment";
import { AuthService } from "./auth.service";

export interface StockResponse {
  message: string;
  response: string[];
}

export interface StockData {
  summary: string;
  report: string;
}

export interface SearchHistory {
  stockName: string;
  ticker: string;
  date: string;
}

@Injectable({
  providedIn: "root",
})
export class StockService {
  private baseUrl = environment.apiUrl;

  private mockResponse: StockResponse = {
    message: "Success",
    response: [
      '{"summary": "As of October 16, 2023, Apple Inc. (AAPL) is trading at approximately $237.31 per share on NASDAQ, showing a mixed performance compared to its tech peers. While the stock trades near the top of its 52-week range and above its 200-day moving average, suggesting underlying technical strength, it remains down about 5% since the beginning of the year, making it the underperformer among the \\"Magnificent Seven\\" tech stocks.\\n\\nRecent quarterly results have been encouraging, with Apple outpacing Wall Street expectations on both revenue and profit. This strong financial performance prompted JPMorgan to raise its price target, with some analysts speculating whether the stock could reach $310 in 2025. The company continues to demonstrate resilience amid broader economic concerns, with reports suggesting Apple and Amazon are \\"defying economic gloom.\\"\\n\\nHowever, investor sentiment is tempered by several challenges. The recent departure of Apple\'s head of ChatGPT-like AI search efforts to Meta represents',
      ' a significant talent loss in the crucial AI space. The market also responded negatively to the iPhone 17 launch event, suggesting concerns about innovation momentum. Additionally, a downgrade from Jefferies analysts has put further pressure on the stock.\\n\\nApple\'s core business model remains centered on its ecosystem of hardware (iPhone, Mac, iPad), services (App Store, Apple TV+, iCloud), and wearables. The company is also expanding manufacturing operations, with recent reports highlighting investment in Vietnam for home hub production.\\n\\nThe market appears particularly focused on Apple\'s AI strategy and whether it can close the perceived innovation gap with competitors. The mixed headlines reflect investor uncertainty about whether Apple\'s traditional strengths in hardware integration and user experience will translate to leadership in the AI era.\\n\\nGiven the current fundamentals, sentiment, and technicals, the recommendation remains: Hold.", "report": "https://bedrock-agentcore-related-data.s3.amazonaw',
      "s.com/analysis-result-apple%20inc-APPL/apple%20inc_report_1fdf52dd-9390-4b03-b1de-9934ea7a4010.html?AWSAccessKeyId=ASIAVRUVVWH7FAA7IUFY&Signature=dDs44Y2VcC2is%2F6JRlzwG20ZaS4%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEOr%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJIMEYCIQCVAZY1LGyssm3dXiMmP3Gi3VYCIh%2BUwYacgH2iuwSaEgIhAMviI%2Bc7OW%2FP9DxSlXfVUKlRrOvBwtkbt%2FYBmRU%2FXnKtKpkDCJP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMzgxNDkyMjQ0OTkwIgy1E9h5e0hBTzXqx6wq7QKlPLBx1eqoBzdhmTj24paJA8cDqkNizGj1hGqc6MC3g6OBf19HQjXgwupicx5ZxYBFjdI86MrBwnDs8x6oTTUF292%2Bj4FnjvOZHP07QcIRN4QtgK6ZQ1nMH3fc7ZEz%2BPXry2HY8OxxWQYpvRAioxYT%2BTkxKQtnlmEUJ7M9yMeTiqzHf9mTDQIWZV%2BXw%2FBtfXgoLg4L1JKMdCL2Ucjchm8bsCdzsBPiW%2FxrYYW0%2FsdwReHW8kDo6Up67vcWHyXi0GqBbmWvDIU1znAm456EmTD%2FjGNTWv8vnZeYL09Xpfma6lDhGS5LOqJaB6p4Y4qDa7dDoLV1QJYZYt%2B4uIi8tokYMh0m4Ros%2BDltiWAk8JfRSaHz7CpbHPKrmdIHsScoH1l7m5zjARLEfLDoGaaiOeYd4QHWayGU3Cs8aPGsvWetK1pcg7INp7x1Tezu0pio87YJpX8ccR0pMNtPTlA72EDYNOstvo7iAVuXkjz3bjCR4cTHBjqXAQVOvzCNu35Wwt%2FWqMRb7jb%2BA7qVfNdeb3J4WwCexcrpPc",
      'xWHDoTAV16PWJ2i0xQvoOhtizmN9Vf95b9AnKj5yhaueUAKtyiQqnZpcx%2FB0pU76Ohp5kFT2E8X9X8OEvhx7msPTdxQ8KDKhKDnV%2BV0oDWT2ujIs2aQXQnCDnsGBQoP5Cj%2FFhRDQGMoeUN9zjvMIcHJ5nWkEw%3D&Expires=1760641547"}',
    ],
  };

  constructor(private http: HttpClient, private authservice: AuthService) {}

  searchStocks(query: string): Observable<any> {
    // Get token from AuthService
    const token = this.authservice.getToken(); // make sure this returns the JWT

    // Create headers with Authorization
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    // Send GET request with headers
    return this.http.get(
      `${this.baseUrl}search?_q=${encodeURIComponent(query)}`,
      { headers }
    );
  }

  getStockReport(stockName: string, ticker: string): Observable<StockResponse> {
    // return new Observable(observer => {
    //   setTimeout(() => {
    //     observer.next(this.mockResponse);
    //     observer.complete();
    //   }, 3000);
    // });

    const token = this.authservice.getToken(); // make sure this returns the JWT

    // Create headers with Authorization
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    const params = {
      stockname: stockName,
      ticker_symbol: ticker,
      actor_id: "noventiqteam_123",
    };

    return this.http.get<StockResponse>(this.baseUrl, { params, headers });
  }

  parseStockData(response: string[]): StockData {
    const dataStr = response.join("");
    return JSON.parse(dataStr);
  }

  saveSearch(stockName: string, ticker: string) {
    const searches = this.getRecentSearches();
    const newSearch: SearchHistory = {
      stockName,
      ticker,
      date: new Date().toISOString(),
    };

    const filtered = searches.filter(
      (s: SearchHistory) => !(s.stockName === stockName && s.ticker === ticker)
    );
    filtered.unshift(newSearch);

    localStorage.setItem("stockSearches", JSON.stringify(filtered.slice(0, 5)));
  }

  getRecentSearches(): SearchHistory[] {
    const searches = localStorage.getItem("stockSearches");
    return searches ? JSON.parse(searches) : [];
  }
}
