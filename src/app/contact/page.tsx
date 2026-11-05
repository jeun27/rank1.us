import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/contact/ContactForm";
import { SimplePage } from "@/components/contact/SimplePage";

export const metadata: Metadata = { title: "Contact us - Rank1" };

export default function ContactPage() {
  return (
    <SimplePage title="Contact us">
      <Card>
        <ContactForm />
      </Card>
    </SimplePage>
  );
}
