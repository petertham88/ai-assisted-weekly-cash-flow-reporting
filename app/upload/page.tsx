"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [opening, setOpening] = useState("500000");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("openingBalance", opening);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Upload failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.push(`/report/${data.reportId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Upload Weekly Data</h1>
        <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
          ← Back
        </Link>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Upload a CSV or Excel file with your week&apos;s cash flow lines. Columns are matched automatically
        (description, category, subcategory, week, forecast, actual). The system consolidates the 4-week forecast,
        flags risks, and drafts a management report.
        {" "}
        <a href="/demo_cashflow.csv" download className="font-medium text-blue-600 hover:underline">
          Download a sample CSV
        </a>
        .
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 bg-white hover:bg-neutral-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xls,.xlsx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p className="font-medium text-neutral-800">{file.name}</p>
            <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(1)} KB · click to change</p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-neutral-700">Drag &amp; drop a file here</p>
            <p className="text-xs text-neutral-500">or click to browse — CSV, XLSX</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium text-neutral-600">Opening bank balance (Week 1)</span>
          <input
            type="number"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={!file || busy}
          onClick={submit}
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {busy ? "Uploading & consolidating…" : "Upload & Build Report"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </main>
  );
}
