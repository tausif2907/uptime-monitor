"use client";

import { DEFAULT_TIMEOUT_MS, INTERVAL_OPTIONS, MAX_TIMEOUT_MS } from "@uptime/shared";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Button, Field, FormError, Input, Select } from "@/components/ui";
import { testUrl, type TestUrlResult } from "@/lib/actions/monitors";
import type { FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface MonitorDefaults {
  name: string;
  url: string;
  method: string;
  intervalSec: number;
  timeoutMs: number;
  expectedStatus: number;
}

function TestResult({ test }: { test: TestUrlResult }) {
  if (test.error) return <Alert tone="error">{test.error}</Alert>;
  const r = test.result;
  if (!r) return null;
  return (
    <Alert tone={r.ok ? "success" : "warning"} className="animate-slide-up">
      <div className="flex items-start gap-2">
        {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-medium">
            {r.ok ? "Looks good — this check would pass." : "This check would fail."}
          </p>
          <p className="mt-0.5">
            {r.statusCode != null && <>Status <b>{r.statusCode}</b></>}
            {r.responseTimeMs != null && <> · {r.responseTimeMs} ms</>}
            {r.error && <> · {r.error}</>}
          </p>
          {!r.ok && r.statusCode != null && (
            <p className="mt-1 text-xs">
              Tip: if the site works in your browser, set “Expected status code” to {r.statusCode} — some sites
              block automated checks or redirect them.
            </p>
          )}
        </div>
      </div>
    </Alert>
  );
}

export function MonitorForm({
  action,
  defaults,
  submitLabel = "Create monitor",
}: {
  action: Action;
  defaults?: MonitorDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [test, setTest] = useState<TestUrlResult | null>(null);
  const [testing, startTest] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormError message={state.error} />
      <Field label="Name" htmlFor="name" errors={errors.name} help="Just a label for you, e.g. “Portfolio” or “Shop checkout”. Shown on your public status page.">
        <Input id="name" name="name" required maxLength={100} defaultValue={defaults?.name} placeholder="My portfolio" />
      </Field>
      <Field
        label="URL to check"
        htmlFor="url"
        errors={errors.url}
        hint="Must be publicly reachable on the internet (http or https)."
        help="The exact page we'll request. Use your homepage, or a health URL like https://api.example.com/health for APIs."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="url" name="url" type="url" required defaultValue={defaults?.url} placeholder="https://example.com" onChange={() => setTest(null)} />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            disabled={testing}
            onClick={() => {
              if (!formRef.current) return;
              const data = new FormData(formRef.current);
              startTest(async () => setTest(await testUrl(data)));
            }}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Test URL
          </Button>
        </div>
      </Field>
      {test && <TestResult test={test} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Method"
          htmlFor="method"
          errors={errors.method}
          help={
            <>
              <b>GET</b> — loads the page like a browser (best for almost everything).
              <br />
              <b>HEAD</b> — asks only for headers; lighter, but some servers don&apos;t support it.
              <br />
              <b>POST</b> — only for API endpoints that require it.
            </>
          }
        >
          <Select id="method" name="method" defaultValue={defaults?.method ?? "GET"}>
            <option value="GET">GET — recommended</option>
            <option value="HEAD">HEAD — headers only</option>
            <option value="POST">POST — APIs only</option>
          </Select>
        </Field>
        <Field label="Check every" htmlFor="intervalSec" errors={errors.intervalSec} help="How often we visit the URL. 1 minute catches outages fastest.">
          <Select id="intervalSec" name="intervalSec" defaultValue={defaults?.intervalSec ?? 60}>
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s / 60} minute{s === 60 ? "" : "s"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Timeout (ms)" htmlFor="timeoutMs" errors={errors.timeoutMs} help="If the site hasn't answered within this time, the check fails. 10000 ms = 10 seconds is a good default.">
          <Input id="timeoutMs" name="timeoutMs" type="number" min={1000} max={MAX_TIMEOUT_MS} step={500} defaultValue={defaults?.timeoutMs ?? DEFAULT_TIMEOUT_MS} />
        </Field>
        <Field label="Expected status code" htmlFor="expectedStatus" errors={errors.expectedStatus} help="200 means “OK, the page loaded”. If your site intentionally returns something else (e.g. 301 redirect), put that here.">
          <Input id="expectedStatus" name="expectedStatus" type="number" min={100} max={599} defaultValue={defaults?.expectedStatus ?? 200} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <SubmitButton>{submitLabel}</SubmitButton>
        <p className="text-xs text-zinc-500">We&apos;ll alert you after 2 failed checks in a row.</p>
      </div>
    </form>
  );
}
