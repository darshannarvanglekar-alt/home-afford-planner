import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — HomeAfford" }, { name: "description", content: "HomeAfford privacy policy." }] }),
  component: PrivacyPage,
});

const sections = [
  ["What we collect", "We collect your name and email address when you sign in. We store your financial summaries and property plans to power your affordability plans."],
  ["What we do NOT collect", "We do not store your bank statements. Uploaded files are analysed in memory and permanently deleted immediately after extraction."],
  ["How we use your data", "Your data is used only to generate your affordability plan. We do not sell your data to any third party."],
  ["Data security", "Your data is stored securely on Supabase with industry-standard encryption."],
  ["Contact", "For any privacy concerns contact us at: [placeholder email]"],
];

function PrivacyPage() {
  return <LegalPage title="Privacy Policy" sections={sections} />;
}

function LegalPage({ title, sections }: { title: string; sections: string[][] }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
        <div className="mt-10 space-y-8">
          {sections.map(([heading, body], index) => (
            <section key={heading}>
              <h2 className="text-lg font-bold text-foreground">{index + 1}. {heading}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}