import { Notice, PageHeader } from "@/components/ui";
import { getEnabledModules } from "@/lib/modules";
import { requireMember } from "@/lib/session";
import { getModule } from "@/modules/catalog";
import { moduleHomeCards } from "@/modules/server";

/** Dashboard home: one summary card per module the client has switched on. */
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const { user, clientId } = await requireMember();
  const modules = await getEnabledModules(clientId);
  const { "module-off": moduleOff } = await searchParams;
  const offName = typeof moduleOff === "string" ? getModule(moduleOff)?.name : undefined;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Here’s how things are going across your tools." />
      {offName && (
        <div className="mb-6">
          <Notice tone="warn">{offName} isn’t switched on for your account. Contact Nostalgic Studio if you’d like to use it.</Notice>
        </div>
      )}
      {modules.length === 0 ? (
        <Notice>No tools are switched on for your account yet. Contact Nostalgic Studio to get started.</Notice>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {modules.map((key) => {
            const HomeCard = moduleHomeCards[key];
            return <HomeCard key={key} clientId={clientId} />;
          })}
        </div>
      )}
    </>
  );
}
