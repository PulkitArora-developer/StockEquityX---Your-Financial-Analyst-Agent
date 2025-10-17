import { Routes } from "@angular/router";
import { LoginComponent } from "./login.component";
import { DashboardComponent } from "./dashboard.component";
import { AuthGuard } from "./auth/auth-guard";

export const routes: Routes = [
  { path: "", redirectTo: "/login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  { path: "**", redirectTo: "/login" },
];
