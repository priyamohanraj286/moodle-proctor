import { Sidebar } from "@components/Sidebar";
import { TopNavbar } from "@components/TopNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex gap-4 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
        <TopNavbar />
        <main className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

