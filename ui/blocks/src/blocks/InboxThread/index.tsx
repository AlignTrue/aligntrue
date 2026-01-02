import React from "react";
import { inboxThreadManifest } from "./manifest.js";

export interface InboxMessage {
  id: string;
  sender: string;
  body: string;
}

export interface InboxThreadProps {
  subject: string;
  messages: InboxMessage[];
}

export function InboxThread({ subject, messages }: InboxThreadProps) {
  return (
    <div data-block="inbox-thread">
      <h4>{subject}</h4>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.sender}:</strong> {m.body}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { inboxThreadManifest };
