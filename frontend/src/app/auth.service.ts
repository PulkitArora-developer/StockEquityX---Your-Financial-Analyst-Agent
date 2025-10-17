import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isLoggedIn = false;

  login(username: string, password: string): boolean {
    // Check against environment credentials
    if (username === environment.email && password === environment.password) {
      this.isLoggedIn = true;
      localStorage.setItem('isLoggedIn', 'true');
      return true;
    }
    return false;
  }

  logout() {
    this.isLoggedIn = false;
    localStorage.removeItem('isLoggedIn');
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn || localStorage.getItem('isLoggedIn') === 'true';
  }
}
