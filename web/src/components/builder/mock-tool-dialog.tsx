"use client";

import { useForm } from "@tanstack/react-form";

import {
  Advanced,
  DescribeStep,
  HandBackStep,
  MappingsCard,
  NumberField,
  Row,
  Step,
  SwitchField,
  TextAreaField,
  TextField,
  ToolDialogShell,
} from "@/components/builder/tool-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { mockToolDefaults, mockToolSchema, type MockToolValues } from "@/lib/tools/schemas";

const SAMPLE_RESPONSE = `{
  "available": true,
  "rooms": [{ "type": "deluxe", "price": 4200 }]
}`;

export function MockToolDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MockToolValues) => void | Promise<void>;
}) {
  const form = useForm({
    defaultValues: mockToolDefaults,
    validators: { onChange: mockToolSchema },
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
          title="Mock API"
          description="Hand the agent a canned answer, so you can rehearse the conversation before the API exists."
          onCancel={() => onOpenChange(false)}
        >
          <DescribeStep form={form} />

          <Step
            n={2}
            title="Write the reply"
            hint="Nothing leaves the machine — the agent is handed exactly this."
          >
            <form.Field name="responseBody">
              {(field) => (
                <TextAreaField
                  field={field}
                  rows={7}
                  spellCheck={false}
                  placeholder={SAMPLE_RESPONSE}
                  aria-label="Mock response body"
                  className="min-h-40 resize-none rounded-lg px-3 py-2.5 font-mono text-xs leading-6"
                />
              )}
            </form.Field>

            <div className="surface divide-y divide-border overflow-hidden">
              <Row label="Reply with" hint="The status code the agent sees.">
                <form.Field name="statusCode">
                  {(field) => (
                    <NumberField
                      field={field}
                      min={100}
                      max={599}
                      aria-label="Status code"
                      className="h-8 w-20 rounded-lg px-3 text-center font-mono text-xs"
                    />
                  )}
                </form.Field>
              </Row>

              <Row
                label="Pretend it is slow"
                hint="Wait this long before replying, as a real API would."
              >
                <form.Field name="delaySeconds">
                  {(field) => (
                    <NumberField
                      field={field}
                      min={0}
                      max={30}
                      aria-label="Seconds of delay"
                      className="h-8 w-20 rounded-lg px-3 text-center font-mono text-xs"
                    />
                  )}
                </form.Field>
                <span className="text-[13px] text-muted-foreground">sec</span>
              </Row>
            </div>
          </Step>

          <HandBackStep form={form} n={3} />

          <Advanced>
            <div className="surface divide-y divide-border overflow-hidden">
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
              <form.Field name="realUrl">
                {(field) => (
                  <TextField
                    field={field}
                    label="Swap in the real API later"
                    hint="Point this at a URL and the mock reply is ignored."
                    placeholder="https://api.example.com/bookings"
                    className="h-8 rounded-lg font-mono text-xs"
                  />
                )}
              </form.Field>
            </div>

            <MappingsCard
              form={form}
              keyPlaceholder="rooms[0].price"
              valuePlaceholder="room_price"
            />
          </Advanced>
        </ToolDialogShell>
      </DialogContent>
    </Dialog>
  );
}
