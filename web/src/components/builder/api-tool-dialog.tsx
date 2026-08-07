"use client";

import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { Play } from "lucide-react";

import {
  Advanced,
  DescribeStep,
  HandBackStep,
  MappingsCard,
  NumberField,
  PairListField,
  Row,
  Step,
  SwitchField,
  TextAreaField,
  TextField,
  ToolDialogShell,
} from "@/components/builder/tool-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiToolDefaults, apiToolSchema, type ApiToolValues } from "@/lib/tools/schemas";

const SAMPLE_CURL = `curl -X POST https://api.example.com/bookings \\
  -H 'Content-Type: application/json' \\
  -d '{"phone": "@caller_phone", "date": "@date"}'`;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARTS = ["params", "headers", "auth", "body"];

export function ApiToolDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ApiToolValues) => void | Promise<void>;
}) {
  const form = useForm({
    defaultValues: apiToolDefaults,
    validators: { onChange: apiToolSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86svh] flex-col gap-0 rounded-2xl p-0 sm:max-w-2xl">
        <ToolDialogShell
          form={form}
          title="API tool"
          description="Call your API mid-conversation to look something up or write something down."
          onCancel={() => onOpenChange(false)}
        >
          <DescribeStep form={form} />

          <Step n={2} title="Set up the request">
            <form.Field name="source">
              {(source) => (
                <Tabs
                  value={source.state.value}
                  onValueChange={(value) => source.handleChange(String(value) as "curl" | "manual")}
                  className="gap-3"
                >
                  <TabsList variant="line" className="h-8">
                    <TabsTrigger value="curl" className="flex-none px-1 text-[13px]">
                      Paste a cURL
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-none px-1 text-[13px]">
                      Build it
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="curl" className="flex flex-col gap-2">
                    <form.Field name="curl">
                      {(field) => (
                        <div className="flex flex-col gap-1.5">
                          <div className="overflow-hidden rounded-xl border border-border bg-muted/40 focus-within:border-ring">
                            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                cURL
                              </span>
                              <Button
                                variant="outline"
                                size="xs"
                                type="button"
                                className="ml-auto rounded-full bg-background px-2.5"
                              >
                                <Play data-icon="inline-start" />
                                Send
                              </Button>
                            </div>
                            <TextAreaField
                              field={field}
                              rows={5}
                              spellCheck={false}
                              placeholder={SAMPLE_CURL}
                              aria-label="cURL command"
                              className="min-h-28 resize-none rounded-none border-0 bg-transparent px-3 py-3 font-mono text-xs leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
                            />
                          </div>
                          <p className="text-[13px] text-muted-foreground">
                            We read the method, URL, headers, and body out of it — nothing is sent
                            until you press Send.
                          </p>
                        </div>
                      )}
                    </form.Field>
                  </TabsContent>

                  <TabsContent value="manual" className="flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <form.Field name="method">
                        {(field) => (
                          <Select
                            value={field.state.value}
                            onValueChange={(value) =>
                              field.handleChange(String(value) as ApiToolValues["method"])
                            }
                          >
                            <SelectTrigger className="h-9 w-28 rounded-lg font-mono text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {METHODS.map((verb) => (
                                <SelectItem key={verb} value={verb} className="font-mono text-xs">
                                  {verb}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </form.Field>

                      <form.Field name="url">
                        {(field) => (
                          <div className="min-w-0 flex-1">
                            <TextField
                              field={field}
                              placeholder="https://api.example.com/bookings"
                              aria-label="URL"
                              className="h-9 rounded-lg font-mono text-xs"
                            />
                          </div>
                        )}
                      </form.Field>

                      <Button size="lg" type="button" className="shrink-0 rounded-lg px-3">
                        <Play data-icon="inline-start" />
                        Send
                      </Button>
                    </div>

                    <Tabs defaultValue="params">
                      <TabsList variant="line" className="h-8">
                        {PARTS.map((tab) => (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className="flex-none px-1 text-[13px] capitalize"
                          >
                            {tab}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      <TabsContent value="params" className="pt-1">
                        <form.Field name="params">
                          {(field: AnyFieldApi) => (
                            <PairListField
                              field={field}
                              keyPlaceholder="name"
                              valuePlaceholder="@caller_phone"
                              addLabel="Add parameter"
                            />
                          )}
                        </form.Field>
                      </TabsContent>

                      <TabsContent value="headers" className="pt-1">
                        <form.Field name="headers">
                          {(field: AnyFieldApi) => (
                            <PairListField
                              field={field}
                              keyPlaceholder="Content-Type"
                              valuePlaceholder="application/json"
                              addLabel="Add header"
                            />
                          )}
                        </form.Field>
                      </TabsContent>

                      <TabsContent value="auth" className="pt-1">
                        <form.Field name="auth">
                          {(field) => (
                            <TextField
                              field={field}
                              type="password"
                              placeholder="Bearer token"
                              aria-label="Authorization"
                              className="h-8 rounded-lg font-mono text-xs"
                            />
                          )}
                        </form.Field>
                      </TabsContent>

                      <TabsContent value="body" className="pt-1">
                        <form.Field name="body">
                          {(field) => (
                            <TextAreaField
                              field={field}
                              rows={5}
                              spellCheck={false}
                              placeholder={'{\n  "phone": "@caller_phone"\n}'}
                              aria-label="Request body"
                              className="min-h-28 resize-none rounded-lg px-3 py-2.5 font-mono text-xs leading-6"
                            />
                          )}
                        </form.Field>
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              )}
            </form.Field>
          </Step>

          <HandBackStep form={form} n={3} />

          <Advanced>
            <div className="surface divide-y divide-border overflow-hidden">
              <Row label="Max wait" hint="How long the agent waits before it gives up.">
                <form.Field name="maxWait">
                  {(field) => (
                    <NumberField
                      field={field}
                      min={1}
                      max={60}
                      aria-label="Seconds"
                      className="h-8 w-20 rounded-lg px-3 text-center font-mono text-xs"
                    />
                  )}
                </form.Field>
                <span className="text-[13px] text-muted-foreground">sec</span>
              </Row>

              <Row
                label="Keep it available"
                hint="Leave the tool in reach for the rest of the conversation."
              >
                <form.Field name="keepAvailable">
                  {(field) => <SwitchField field={field} />}
                </form.Field>
              </Row>
            </div>

            <div className="surface flex flex-col gap-2 p-4">
              <form.Field name="failureMessage">
                {(field) => (
                  <TextAreaField
                    field={field}
                    label="If it fails"
                    hint="What the agent says on a timeout or an error."
                    rows={2}
                    placeholder="Apologise briefly and offer to carry on with the rest of the request."
                    className="min-h-16 resize-none rounded-lg px-3 py-2.5 text-[13px]"
                  />
                )}
              </form.Field>
            </div>

            <MappingsCard
              form={form}
              keyPlaceholder="results[0].balance"
              valuePlaceholder="account_balance"
            />
          </Advanced>
        </ToolDialogShell>
      </DialogContent>
    </Dialog>
  );
}
