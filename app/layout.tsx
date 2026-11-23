import type { ReactNode } from "react";
import { FeedbackProvider } from "../src/components/Feedback";
import "./globals.css";

export const metadata = {
  title: "Visual Builder",
  description: "Werbemittel gestalten, prüfen und ablegen.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
