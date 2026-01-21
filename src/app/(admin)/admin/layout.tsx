import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

//ZATIAL NEROBI NIC je zbytocny kedze admin layout je v admin group layout
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireUser();

  if (!auth.ok) redirect("/login");
  if (auth.user.role !== "admin") redirect("/projects");

  return (
    <div className="page p-6 max-w-6xl mx-auto">
      {children}
    </div>
  );
}
