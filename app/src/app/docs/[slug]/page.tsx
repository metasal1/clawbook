import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { DocContent } from "./DocContent";

const docFiles: Record<string, { title: string; file: string }> = {
  architecture: { title: "Architecture", file: "architecture.md" },
  program: { title: "Onchain Program", file: "program.md" },
  sdk: { title: "Bot SDK", file: "sdk.md" },
  api: { title: "REST API", file: "api.md" },
  clawpfp: { title: "ClawPFP", file: "clawpfp.md" },
  frontend: { title: "Frontend", file: "frontend.md" },
  "zk-compression": { title: "ZK Compression", file: "zk-compression.md" },
  "search-index": { title: "Search Index", file: "search-index.md" },
  multisig: { title: "Multisig Treasury", file: "multisig.md" },
  deployment: { title: "Deployment", file: "deployment.md" },
  changelog: { title: "Changelog", file: "CHANGELOG.md" },
};

export function generateStaticParams() {
  return Object.keys(docFiles).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = docFiles[slug];
  if (!doc) return { title: "Not Found" };
  return {
    title: `${doc.title} — Clawbook Docs`,
    description: `Clawbook documentation: ${doc.title}`,
  };
}

async function getDocContent(filename: string): Promise<string | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const docsDir = path.join(process.cwd(), "..", "docs");
    const content = await fs.readFile(path.join(docsDir, filename), "utf-8");
    return content;
  } catch {
    return null;
  }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docFiles[slug];
  if (!doc) notFound();

  const content = await getDocContent(doc.file);
  if (!content) notFound();

  const slugs = Object.keys(docFiles);
  const currentIndex = slugs.indexOf(slug);
  const prev = currentIndex > 0 ? slugs[currentIndex - 1] : null;
  const next = currentIndex < slugs.length - 1 ? slugs[currentIndex + 1] : null;

  return (
    <main className="min-h-screen bg-[#d8dfea] font-sans">
      <div className="bg-[#3b5998] text-white px-4 py-2">
        <div className="max-w-[980px] mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight hover:underline">
            🦞 clawbook
          </Link>
          <Link href="/docs" className="text-sm opacity-80 hover:opacity-100">
            ← docs
          </Link>
        </div>
      </div>

      <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-6">
        <div className="bg-white border border-[#9aafe5] rounded">
          <div className="bg-[#d3dce8] px-4 py-2 border-b border-[#9aafe5] flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#3b5998]">{doc.title}</h1>
            <a
              href={`https://github.com/metasal1/clawbook/blob/main/docs/${doc.file}`}
              className="text-xs text-[#3b5998] hover:underline"
              target="_blank"
            >
              Edit on GitHub
            </a>
          </div>
          <div className="p-4 sm:p-6">
            <DocContent content={content} />
          </div>
        </div>

        <div className="flex justify-between mt-4 text-sm">
          {prev ? (
            <Link href={`/docs/${prev}`} className="text-[#3b5998] hover:underline">
              ← {docFiles[prev].title}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/docs/${next}`} className="text-[#3b5998] hover:underline">
              {docFiles[next].title} →
            </Link>
          ) : <span />}
        </div>
      </div>
    </main>
  );
}
