import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from "@angular/router";
import { Observable } from "rxjs";
import { AuthService } from "../auth.service";

@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {
    // ✅ Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      // ✅ (Optional) Role-based access control

      return true; // Allow route access
    }

    // 🚫 Not logged in — redirect to login page
    this.router.navigate(["/login"], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
