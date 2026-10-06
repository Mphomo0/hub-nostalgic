"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Papa from "papaparse";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError, SubmitButton } from "@/components/form-state";
import { Card, cx, Input, Label, Notice, Table } from "@/components/ui";
import { normaliseRow, SKIP_REASONS, type IntakeRow } from "@/modules/reviews/lib/normalise";
import { csvSendFormSchema, manualSendSchema } from "@/modules/reviews/schemas";
import { sendRequestsAction, type SendSummary } from "./actions";

type Props = { paused: boolean; consentStatement: string; maxRows: number };

export function SendForms({ paused, consentStatement, maxRows }: Props) {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [summary, setSummary] = useState<SendSummary | null>(null);

  return (
    <div className="space-y-6">
      {paused && <Notice tone="warn">Sending is disabled while your account is paused.</Notice>}
      <div role="tablist" aria-label="How to add customers" className="inline-flex rounded-lg border border-line bg-card p-1">
        {(["manual", "csv"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setSummary(null);
            }}
            className={cx("rounded-md px-4 py-2 text-sm font-medium", tab === t ? "bg-brand text-brand-ink" : "text-ink hover:bg-black/5")}
          >
            {t === "manual" ? "One customer" : "Upload CSV"}
          </button>
        ))}
      </div>

      {tab === "manual" ? (
        <ManualForm paused={paused} consentStatement={consentStatement} onDone={setSummary} />
      ) : (
        <CsvForm paused={paused} consentStatement={consentStatement} maxRows={maxRows} onDone={setSummary} />
      )}

      {summary && <SummaryView summary={summary} />}
    </div>
  );
}

type ConsentProps = { statement: string; error?: { message?: string } } & React.ComponentProps<"input">;

function Consent({ statement, error, ...input }: ConsentProps) {
  return (
    <div>
      <label className="flex items-start gap-3 rounded-lg border border-line bg-paper p-3 text-sm">
        <input type="checkbox" aria-invalid={!!error} className="mt-0.5 size-4 shrink-0 accent-brand" {...input} />
        <span>{statement}</span>
      </label>
      <FieldError error={error} />
    </div>
  );
}

function ManualForm({ paused, consentStatement, onDone }: { paused: boolean; consentStatement: string; onDone: (s: SendSummary) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof manualSendSchema>>({
    resolver: zodResolver(manualSendSchema),
    mode: "onTouched",
    defaultValues: { name: "", phone: "", email: "", consent: false },
  });

  const onSubmit = handleSubmit(async ({ name, phone, email, consent }) => {
    const result = await sendRequestsAction({ rows: [{ name, phone, email }], consent, source: "manual" });
    onDone(result);
    if (result.ok && result.queued > 0) reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="space-y-4">
        <div>
          <Label htmlFor="m-name">Customer name</Label>
          <Input id="m-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
          <FieldError error={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="m-phone" hint="(WhatsApp)">Mobile number</Label>
            <Input id="m-phone" type="tel" inputMode="tel" placeholder="082 123 4567" autoComplete="off" aria-invalid={!!errors.phone} {...register("phone")} />
            <FieldError error={errors.phone} />
          </div>
          <div>
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
            <FieldError error={errors.email} />
          </div>
        </div>
        <p className="text-xs text-muted">Add a mobile number, an email, or both. If both are given we use WhatsApp, with email as a backup.</p>
        <Consent statement={consentStatement} error={errors.consent} {...register("consent")} />
        <SubmitButton disabled={paused} pending={isSubmitting} pendingText="Sending…">Send review request</SubmitButton>
      </Card>
    </form>
  );
}

type PreviewRow = { index: number; row: IntakeRow; error: string | null };

function CsvForm({ paused, consentStatement, maxRows, onDone }: { paused: boolean; consentStatement: string; maxRows: number; onDone: (s: SendSummary) => void }) {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof csvSendFormSchema>>({
    resolver: zodResolver(csvSendFormSchema),
    mode: "onTouched",
    defaultValues: { consent: false },
  });

  // Parse and check the file as soon as it's chosen, so problems show before sending.
  function onFile(file: File | undefined) {
    setPreview(null);
    clearErrors("file");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("file", { message: "That file is too big. Max 2 MB." });
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        if (!fields.includes("name") || (!fields.includes("phone") && !fields.includes("email"))) {
          return setError("file", { message: "The CSV needs a 'name' column and a 'phone' and/or 'email' column. Download the template to see the format." });
        }
        if (res.data.length === 0) return setError("file", { message: "No rows found in that file." });
        if (res.data.length > maxRows) return setError("file", { message: `That file has ${res.data.length} rows. The limit is ${maxRows} per upload; please split it.` });
        // Check for duplicates in the file the same way the server will.
        const seen = new Set<string>();
        setPreview(
          res.data.map((r, index) => {
            const row = { name: r.name ?? "", phone: r.phone ?? "", email: r.email ?? "" };
            const n = normaliseRow(row);
            let error = n.ok ? null : SKIP_REASONS[n.reason];
            if (n.ok) {
              const keys = [n.phoneE164 && `p:${n.phoneE164}`, n.email && `e:${n.email}`].filter(Boolean) as string[];
              if (keys.some((k) => seen.has(k))) error = SKIP_REASONS.DUPLICATE_IN_BATCH;
              keys.forEach((k) => seen.add(k));
            }
            return { index, row, error };
          }),
        );
      },
      error: () => setError("file", { message: "Couldn't read that file. Make sure it's a .csv." }),
    });
  }

  const valid = preview?.filter((p) => !p.error) ?? [];
  const invalid = preview?.filter((p) => p.error) ?? [];
  const fileField = register("file");

  const onSubmit = handleSubmit(async ({ file, consent }) => {
    if (valid.length === 0) return setError("file", { message: "There are no valid rows to send." });
    const result = await sendRequestsAction({ rows: valid.map((p) => p.row), consent, source: "csv", fileName: file?.[0]?.name });
    // Map server row indexes back to the original file rows.
    result.skipped = result.skipped.map((s) => ({ ...s, rowIndex: valid[s.rowIndex]?.index ?? s.rowIndex }));
    result.skipped.push(...invalid.map((p) => ({ rowIndex: p.index, name: p.row.name ?? "", reason: p.error! })));
    result.skipped.sort((a, b) => a.rowIndex - b.rowIndex);
    onDone(result);
    if (result.ok) {
      setPreview(null);
      reset();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="csv" hint={`(up to ${maxRows} rows)`}>CSV file</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              aria-invalid={!!errors.file}
              {...fileField}
              onChange={(e) => {
                fileField.onChange(e);
                onFile(e.target.files?.[0]);
              }}
            />
          </div>
          <a href="/customers-template.csv" download className="text-sm font-semibold text-brand-strong underline">Download template</a>
        </div>
        <FieldError error={errors.file} />
        <p className="text-xs text-muted">Columns: <code>name</code>, <code>phone</code>, <code>email</code>. South African numbers can be written as 082… or +27….</p>

        {preview && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span><strong>{valid.length}</strong> ready to check</span>
              {invalid.length > 0 && <span className="text-danger"><strong>{invalid.length}</strong> with problems (will be skipped)</span>}
            </div>
            <div className="max-h-96 overflow-auto">
              <Table>
                <thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Email</th><th>Check</th></tr></thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.index} className={p.error ? "bg-danger-soft/50" : undefined}>
                      <td className="tabular-nums text-muted">{p.index + 2}</td>
                      <td>{p.row.name}</td>
                      <td>{p.row.phone}</td>
                      <td>{p.row.email}</td>
                      <td>{p.error ? <span className="text-danger">{p.error}</span> : <span className="text-brand-strong">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="text-xs text-muted">Row numbers match your spreadsheet (row 1 is the header). Opt-outs, recent contacts and the monthly limit are checked when you send.</p>
            <Consent statement={consentStatement} error={errors.consent} {...register("consent")} />
            <SubmitButton disabled={paused || valid.length === 0} pending={isSubmitting} pendingText="Sending…">
              {`Send to ${valid.length} customer${valid.length === 1 ? "" : "s"}`}
            </SubmitButton>
          </>
        )}
      </Card>
    </form>
  );
}

function SummaryView({ summary }: { summary: SendSummary }) {
  if (!summary.ok) return <Notice tone="error">{summary.error}</Notice>;
  return (
    <Card aria-live="polite" className="space-y-3">
      <h2 className="font-semibold">Summary</h2>
      <div className="flex flex-wrap gap-6 text-sm">
        <span><strong className="text-lg text-brand-strong">{summary.queued}</strong> sending</span>
        <span><strong className="text-lg">{summary.skipped.length}</strong> skipped</span>
        {summary.failed > 0 && <span className="text-danger"><strong className="text-lg">{summary.failed}</strong> failed</span>}
      </div>
      {summary.queued > 0 && <p className="text-sm text-muted">Messages go out within a minute. Track them on the Requests page.</p>}
      {summary.skipped.length > 0 && (
        <ul className="max-h-64 overflow-auto rounded-lg border border-line text-sm">
          {summary.skipped.map((s, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-line px-3 py-2 last:border-0">
              <span>{s.name || "(no name)"}</span>
              <span className="text-muted">{s.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
