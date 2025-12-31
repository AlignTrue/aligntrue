import type { BlockAction, BlockManifest } from "@aligntrue/ui-contracts";
import Ajv, { type AnySchema } from "ajv";

export interface ActionHandlerResult {
  readonly ui_state_patch?: unknown;
  readonly command_envelope?: unknown;
}

export type ActionHandler = (
  action: BlockAction,
) => Promise<ActionHandlerResult> | ActionHandlerResult;

interface RegisteredHandler {
  readonly handle: ActionHandler;
  readonly validate: (payload: unknown) => boolean | Promise<boolean>;
  readonly errors: () => string[];
}

export class ActionHandlerRegistry {
  private readonly ajv: Ajv;
  private readonly handlers = new Map<string, RegisteredHandler>();

  constructor(ajvInstance?: Ajv) {
    this.ajv = ajvInstance ?? new Ajv({ strict: true, allErrors: true });
  }

  registerFromManifest(
    manifest: BlockManifest,
    actionType: string,
    handler: ActionHandler,
  ): void {
    const actionSchema = manifest.actions?.find(
      (a) => a.action_type === actionType,
    );
    if (!actionSchema) {
      throw new Error(
        `Action ${actionType} not declared in manifest ${manifest.block_id}`,
      );
    }
    const validateFn = this.ajv.compile(
      actionSchema.payload_schema as AnySchema,
    );
    this.handlers.set(actionType, {
      handle: handler,
      validate: (payload: unknown) =>
        validateFn(payload) as boolean | Promise<boolean>,
      errors: () =>
        (validateFn.errors ?? []).map((e) =>
          `${e.instancePath || "/"} ${e.message ?? ""}`.trim(),
        ),
    });
  }

  async dispatch(
    action: BlockAction,
  ): Promise<
    { ok: true; result: ActionHandlerResult } | { ok: false; errors: string[] }
  > {
    const handler = this.handlers.get(action.action_type);
    if (!handler) {
      return { ok: false, errors: [`No handler for ${action.action_type}`] };
    }
    const valid = await handler.validate(action.payload);
    if (!valid) {
      return { ok: false, errors: handler.errors() };
    }
    const result = await handler.handle(action);
    return { ok: true, result };
  }
}
