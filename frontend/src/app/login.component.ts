import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-image">
      <div class="card w-full max-w-md fade-in">
        <div class="card-body">
          <div class="img-fluid text-center mb-2">
            <img
              src="./assets/logo.webp"
              style="width:300px; margin: 0 auto; display: block;"
            />
          </div>
          <div class="text-center mb-8 mt-6">
            <h1 class="text-3xl font-bold text-white mb-2">
              StockEquityX
            </h1>
            <p class="text-gray-400">Sign in to access your dashboard</p>
          </div>

          <form (ngSubmit)="onLogin()" class="space-y-6">
            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="text"
                [(ngModel)]="username"
                name="username"
                class="input"
                placeholder="Enter Email"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                class="input"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              class="btn btn-primary w-full"
              [disabled]="loading"
            >
              <span *ngIf="!loading">Sign In</span>
              <span *ngIf="loading">Signing In...</span>
            </button>
          </form>

          <div *ngIf="error" class="text-center text-sm text-red-400 mt-6 p-4">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .min-h-screen {
        min-height: 100vh;
      }
      .flex {
        display: flex;
      }
      .items-center {
        align-items: center;
      }
      .justify-center {
        justify-content: center;
      }
      .p-4 {
        padding: 1rem;
      }
      .w-full {
        width: 100%;
      }
      .max-w-md {
        max-width: 28rem;
      }
      .text-center {
        text-align: center;
      }
      .mb-8 {
        margin-bottom: 2rem;
      }
      .mb-6 {
        margin-bottom: 1.5rem;
      }
      .mb-2 {
        margin-bottom: 0.5rem;
      }
      .mt-6 {
        margin-top: 1.5rem;
      }
      .text-3xl {
        font-size: 1.875rem;
      }
      .text-sm {
        font-size: 0.875rem;
      }
      .font-bold {
        font-weight: 700;
      }
      .font-medium {
        font-weight: 500;
      }
      .text-white {
        color: white;
      }
      .text-gray-400 {
        color: #9ca3af;
      }
      .space-y-6 > * + * {
        margin-top: 1.5rem;
      }
      .block {
        display: block;
      }
      .bg-image {
        position: relative;
      }
      .bg-image::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url('/assets/bt.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0.2;
        z-index: -1;
      }
      .mb-4 {
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    this.loading = true;
    this.error = '';

    setTimeout(() => {
      if (this.authService.login(this.username, this.password)) {
        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'Invalid credentials ';
      }
      this.loading = false;
    }, 2000);
  }
}
