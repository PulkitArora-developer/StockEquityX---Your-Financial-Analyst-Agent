import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from './auth.service';
import { StockService, StockData, SearchHistory } from './stock.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="min-h-screen bg-gray-900 bg-image">
      <!-- Header -->
      <header class="bg-gray-800 border-b border-gray-700 p-4">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
          <h1 class="text-2xl font-bold text-white">StockEquityX</h1>
          <button (click)="logout()" class="btn btn-secondary">Logout</button>
        </div>
      </header>

      <div class="max-w-7xl mx-auto p-6 flex gap-6">
        <!-- Left Sidebar - Search -->
        <div class="w-80 space-y-6">
          <!-- Stock Search -->
          <div class="card fade-in">
            <h2 class="text-lg font-semibold mb-4 text-white">Search Stocks</h2>

            <div class="space-y-3">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                (input)="onSearchInput()"
                class="input"
                placeholder="Search stocks (e.g., TATA, APPLE)"
              />

              <!-- Search Results -->
              <div
                *ngIf="searchResults.length > 0"
                class="max-h-60 overflow-y-auto space-y-1"
              >
                <div
                  *ngFor="let result of searchResults"
                  (click)="selectStock(result)"
                  class="p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  <div class="text-white font-medium">
                    {{ result.displayName }}
                  </div>
                  <div class="text-gray-400 text-sm">
                    {{ result.symbol }} • {{ result.exchange }}
                  </div>
                  <div class="text-gray-500 text-xs">
                    {{ result.sector }} • {{ result.quote_type }}
                  </div>
                </div>
              </div>

              <!-- Search Loading -->
              <div *ngIf="searchLoading" class="p-3 text-center text-gray-400">
                Searching...
              </div>
            </div>
          </div>

          <!-- Recent Searches -->
          <div *ngIf="recentSearches.length > 0" class="card">
            <h3 class="text-lg font-semibold mb-3 text-white">
              Recent Searches
            </h3>
            <div class="space-y-2">
              <button
                *ngFor="let search of recentSearches"
                (click)="loadSearch(search)"
                class="w-full text-left p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
              >
                <div class="text-white text-sm">{{ search.stockName }}</div>
                <div class="text-gray-400 text-xs">{{ search.ticker }}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 space-y-6">
          <!-- Analysis Form -->
          <div class="card fade-in">
            <h2 class="text-xl font-semibold mb-6 text-white">
              Stock Analysis
            </h2>

            <form (ngSubmit)="onSubmit()" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-2"
                    >Stock Name</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="stockName"
                    name="stockName"
                    class="input"
                    placeholder="e.g., Apple INC"
                    required
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2"
                    >Ticker Symbol</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="ticker"
                    name="ticker"
                    class="input"
                    placeholder="e.g., AAPL"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="loading"
              >
                <span *ngIf="!loading">Generate Report</span>
                <span *ngIf="loading">Generating...</span>
              </button>
            </form>
          </div>

          <!-- Loading State with Financial Tips -->
          <div *ngIf="loading" class="card">
            <div class="text-center">
              <div class="loading-spinner mb-6">
                <div class="spinner"></div>
              </div>
              <h3 class="text-lg font-semibold mb-4 text-white">
                Analyzing Stock Data...
              </h3>
              <div class=" bg-gray-800 rounded-lg p-6">
                <p class="text-gray-300 text-lg leading-relaxed">
                  {{ financialTips[currentTipIndex] }}
                </p>
              </div>
              <div class="mt-4 text-sm text-gray-400">
                Fetching comprehensive financial analysis...
              </div>
            </div>
          </div>

          <!-- Results -->
          <div *ngIf="stockData && !loading" class="space-y-6 fade-in">
            <!-- Summary -->
            <!-- <div class="card">
              <h3 class="text-lg font-semibold mb-4 text-white">
                Analysis Summary
              </h3>
              <p class="text-gray-300 leading-relaxed">
                {{ stockData.summary }}
              </p>
            </div> -->

            <!-- Report -->
            <div class="card">
              <h3 class="text-lg font-semibold mb-4 text-white">
                Detailed Report
              </h3>
              <div class="space-y-4">
                <div class="flex gap-4">
                  <button
                    (click)="downloadReport()"
                    class="btn btn-primary"
                    [disabled]="!stockData?.report"
                  >
                    Download Report
                  </button>
                  <!-- <button
                    (click)="openReportInNewTab()"
                    class="btn btn-secondary"
                  >
                    Open in New Tab
                  </button> -->
                </div>

                <div
                  *ngIf="reportBlobUrl"
                  class="border border-gray-600 rounded-lg overflow-hidden"
                >
                  <iframe
                    [src]="reportBlobUrl"
                    class="w-full border-none"
                    style="height: 80vh;"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  >
                  </iframe>
                </div>

                <div
                  *ngIf="reportLoading"
                  class="p-4 bg-gray-800 rounded text-center"
                >
                  <div class="loading-spinner mb-4">
                    <div class="spinner-small"></div>
                  </div>
                  <p class="text-white font-medium mb-3">
                    Loading Detailed Report...
                  </p>
                  <div class=" bg-gray-700 rounded p-4">
                    <p class="text-gray-300 text-sm">
                      {{ financialTips[currentTipIndex] }}
                    </p>
                  </div>
                </div>

                <div
                  *ngIf="!reportBlobUrl && !reportLoading"
                  class="p-4 bg-gray-800 rounded text-center"
                >
                  <p class="text-gray-300">
                    Report will load automatically after generating analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div *ngIf="error" class="card bg-red-900 border-red-700">
            <p class="text-red-200">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .min-h-screen {
        min-h-screen: 100vh;
      }
      .bg-gray-900 {
        background-color: #0e1117;
      }
      .bg-gray-800 {
        background-color: #1a1d23;
      }
      .bg-gray-700 {
        background-color: #2a2d33;
      }
      .bg-red-900 {
        background-color: #7f1d1d;
      }
      .border-b {
        border-bottom-width: 1px;
      }
      .border-gray-700 {
        border-color: #374151;
      }
      .border-red-700 {
        border-color: #b91c1c;
      }
      .p-4 {
        padding: 1rem;
      }
      .p-6 {
        padding: 1.5rem;
      }
      .p-3 {
        padding: 0.75rem;
      }
      .p-2 {
        padding: 0.5rem;
      }
      .max-w-7xl {
        max-width: 80rem;
      }
      .mx-auto {
        margin-left: auto;
        margin-right: auto;
      }
      .flex {
        display: flex;
      }
      .justify-between {
        justify-content: space-between;
      }
      .items-center {
        align-items: center;
      }
      .gap-6 {
        gap: 1.5rem;
      }
      .gap-4 {
        gap: 1rem;
      }
      .w-80 {
        width: 20rem;
      }
      .flex-1 {
        flex: 1 1 0%;
      }
      .text-2xl {
        font-size: 1.5rem;
      }
      .text-xl {
        font-size: 1.25rem;
      }
      .text-lg {
        font-size: 1.125rem;
      }
      .text-sm {
        font-size: 0.875rem;
      }
      .text-xs {
        font-size: 0.75rem;
      }
      .font-bold {
        font-weight: 700;
      }
      .font-semibold {
        font-weight: 600;
      }
      .font-medium {
        font-weight: 500;
      }
      .text-white {
        color: white;
      }
      .text-gray-300 {
        color: #d1d5db;
      }
      .text-gray-400 {
        color: #9ca3af;
      }
      .text-red-200 {
        color: #fecaca;
      }
      .mb-6 {
        margin-bottom: 1.5rem;
      }
      .mb-4 {
        margin-bottom: 1rem;
      }
      .mb-3 {
        margin-bottom: 0.75rem;
      }
      .mb-2 {
        margin-bottom: 0.5rem;
      }
      .space-y-6 > * + * {
        margin-top: 1.5rem;
      }
      .space-y-4 > * + * {
        margin-top: 1rem;
      }
      .space-y-3 > * + * {
        margin-top: 0.75rem;
      }
      .space-y-2 > * + * {
        margin-top: 0.5rem;
      }
      .space-y-1 > * + * {
        margin-top: 0.25rem;
      }
      .grid {
        display: grid;
      }
      .grid-cols-1 {
        grid-template-columns: repeat(1, minmax(0, 1fr));
      }
      .block {
        display: block;
      }
      .w-full {
        width: 100%;
      }
      .w-3-4 {
        width: 75%;
      }
      .h-32 {
        height: 8rem;
      }
      .h-4 {
        height: 1rem;
      }
      .h-screen {
        height: 100vh;
      }
      .max-h-60 {
        max-height: 15rem;
      }
      .overflow-y-auto {
        overflow-y: auto;
      }
      .rounded {
        border-radius: 0.25rem;
      }
      .rounded-lg {
        border-radius: 0.5rem;
      }
      .leading-relaxed {
        line-height: 1.625;
      }
      .bg-yellow-900 {
        background-color: #78350f;
      }
      .text-yellow-200 {
        color: #fef3c7;
      }
      .text-blue-400 {
        color: #60a5fa;
      }
      .underline {
        text-decoration: underline;
      }
      .border {
        border-width: 1px;
      }
      .border-gray-600 {
        border-color: #4b5563;
      }
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #374151;
        border-top: 4px solid #00bcd4;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      .spinner-small {
        width: 30px;
        height: 30px;
        border: 3px solid #374151;
        border-top: 3px solid #00bcd4;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      .tip-container {
        transition: all 0.5s ease-in-out;
        border: 1px solid #4b5563;
      }
      .tip-container-small {
        transition: all 0.5s ease-in-out;
      }
      .tip-icon {
        font-size: 2rem;
        animation: pulse 2s infinite;
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      .bg-image {
        background-image: url('/assets/bt.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        height: 100vh;
      }
      .cursor-pointer {
        cursor: pointer;
      }
      .text-left {
        text-align: left;
      }
      .text-center {
        text-align: center;
      }
      .transition-colors {
        transition-property: color, background-color, border-color,
          text-decoration-color, fill, stroke;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 150ms;
      }

      @media (min-width: 768px) {
        .md\\:grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class DashboardComponent {
  stockName = '';
  ticker = '';
  loading = false;
  stockData: StockData | null = null;
  reportUrl: SafeResourceUrl | null = null;
  error = '';
  recentSearches: SearchHistory[] = [];

  // Financial tips for loader
  financialTips = [
    "💡 Diversification is key - Don't put all your eggs in one basket",
    '📈 Time in the market beats timing the market',
    '💰 Invest only what you can afford to lose',
    '🔍 Always research before investing in any stock',
    '📊 P/E ratio helps evaluate if a stock is overvalued or undervalued',
    '🎯 Set clear investment goals and stick to your strategy',
    '📉 Market volatility is normal - stay calm during downturns',
    '💎 Dollar-cost averaging reduces the impact of market volatility',
    '🏦 Emergency fund should cover 6 months of expenses',
    '📚 Continuous learning is essential for successful investing',
    '⚖️ Balance growth and value stocks in your portfolio',
    '🕐 Start investing early to benefit from compound interest',
  ];

  currentTipIndex = 0;
  tipInterval: any;

  // Search functionality
  searchQuery = '';
  searchResults: any[] = [];
  searchLoading = false;
  private searchTimeout: any;

  // Report handling
  reportBlobUrl: SafeResourceUrl | null = null;
  reportHtmlContent: string = '';
  reportLoading = false;

  startTipRotation() {
    this.currentTipIndex = 0;
    this.tipInterval = setInterval(() => {
      this.currentTipIndex =
        (this.currentTipIndex + 1) % this.financialTips.length;
    }, 3000);
  }

  stopTipRotation() {
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
    }
  }

  constructor(
    private authService: AuthService,
    private stockService: StockService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {
    this.loadRecentSearches();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadRecentSearches() {
    this.recentSearches = this.stockService.getRecentSearches();
  }

  loadSearch(search: SearchHistory) {
    this.stockName = search.stockName;
    this.ticker = search.ticker;
  }

  onSearchInput() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (this.searchQuery.length < 2) {
      this.searchResults = [];
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch();
    }, 300);
  }

  performSearch() {
    this.searchLoading = true;
    this.stockService.searchStocks(this.searchQuery).subscribe({
      next: (response) => {
        // Parse the response based on the API structure
        this.searchResults = this.parseSearchResults(response);
        this.searchLoading = false;
      },
      error: (err) => {
        console.error('Search failed:', err);
        this.searchResults = [];
        this.searchLoading = false;
      },
    });
  }

  parseSearchResults(response: any): any[] {
    if (Array.isArray(response)) {
      return response.map((item) => ({
        exchange: item.exchange,
        symbol: item.symbol,
        shortname: item.shortname,
        longname: item.longname,
        sector: item.sector,
        quote_type: item.quote_type,
        displayName: item.longname || item.shortname || item.symbol,
      }));
    }
    return [];
  }

  selectStock(stock: any) {
    this.stockName = stock.displayName;
    this.ticker = stock.symbol;
    this.searchResults = [];
    this.searchQuery = '';
  }

  loadReportContent() {
    if (!this.stockData?.report) return;

    this.reportLoading = true;
    this.startTipRotation();

    this.http.get(this.stockData.report, { responseType: 'text' }).subscribe({
      next: (html) => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        this.reportBlobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        this.reportLoading = false;
        this.stopTipRotation();
      },
      error: (err) => {
        console.error('Failed to load report:', err);
        this.reportLoading = false;
        this.stopTipRotation();
      },
    });
  }

  openReportInNewTab() {
    if (this.stockData?.report) {
      window.open(this.stockData.report, '_blank');
    }
  }

  downloadReport() {
    if (!this.stockData?.report) return;

    this.http.get(this.stockData.report, { responseType: 'text' }).subscribe({
      next: (html) => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.ticker || 'stock'}-report.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Failed to download report:', err);
      },
    });
  }

  onSubmit() {
    if (!this.stockName || !this.ticker) return;

    this.loading = true;
    this.error = '';
    this.stockData = null;
    this.reportBlobUrl = null;
    this.reportHtmlContent = '';
    this.startTipRotation();

    this.stockService.getStockReport(this.stockName, this.ticker).subscribe({
      next: (response) => {
        try {
          this.stockData = this.stockService.parseStockData(response.response);
          this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            this.stockData.report
          );
          this.stockService.saveSearch(this.stockName, this.ticker);
          this.loadRecentSearches();
          // Automatically load the embedded report
          this.loadReportContent();
        } catch (e) {
          this.error = 'Failed to parse response data';
        }
        this.loading = false;
        this.stopTipRotation();
      },
      error: (err) => {
        this.error = 'Failed to fetch stock data. Please try again.';
        this.loading = false;
        this.stopTipRotation();
      },
    });
  }
}
