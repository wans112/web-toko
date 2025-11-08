import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardClient />
    </Suspense>
  );
}