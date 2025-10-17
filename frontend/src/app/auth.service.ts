import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../environments/environment";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private isLoggedIn = false;

  constructor(private http: HttpClient) {}

  // ✅ Login method that hits API and sends credentials as params
  login(username: string, password: string): Observable<any> {
    const params = new HttpParams()
      .set("email", username)
      .set("password", password);

    return this.http.get(`${environment.apiUrl}login`, { params });
  }

  getToken() {
    return localStorage.getItem("token");
  }

  // ✅ After successful login
  setLoginStatus(status: boolean): void {
    this.isLoggedIn = status;
    localStorage.setItem("isLoggedIn", String(status));
  }

  logout(): void {
    this.isLoggedIn = false;
    localStorage.removeItem("isLoggedIn");
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn || localStorage.getItem("isLoggedIn") === "true";
  }
}
