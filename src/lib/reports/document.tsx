import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { colors } from "@/styles/tokens";
import { REPORT_COPY } from "./copy";
import type { ReportData } from "./data";

// White-label: only the business's name, logo and accent color; no product name, logo or credit.
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: colors.ink },
  cover: { marginBottom: 20 },
  logo: { width: 120, height: 48, objectFit: "contain", marginBottom: 8 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  month: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  h: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  muted: { color: colors.inkMuted },
  big: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: colors.inkMuted },
});

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={[s.h, { borderBottomColor: accent, color: accent }]}>{title}</Text>
      {children}
    </View>
  );
}

const Row = ({ left, right }: { left: string; right: string }) => (
  <View style={s.row}>
    <Text>{left}</Text>
    <Text>{right}</Text>
  </View>
);

export function ReportDocument({ data }: { data: ReportData }) {
  const h = REPORT_COPY.headings;
  const footer = [
    REPORT_COPY.label,
    data.freshness ? `Checked ${data.freshness.slice(0, 10)}` : null,
    `${data.answers} answers`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document
      title={`${data.businessName}, ${data.month}`}
      author={data.businessName}
      creator={data.businessName}
      producer={data.businessName}
    >
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          {data.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; the name follows.
            <Image
              style={s.logo}
              src={{ data: Buffer.from(data.logo.bytes), format: data.logo.type === "image/png" ? "png" : "jpg" }}
            />
          ) : null}
          <Text style={s.name}>{data.businessName}</Text>
          <Text style={s.month}>{data.month}</Text>
        </View>

        <Section title={h.visibility} accent={data.accent}>
          {data.visibility ? (
            <>
              <Text style={s.big}>{data.visibility.text}</Text>
              {data.visibility.change ? <Text style={s.muted}>{data.visibility.change}</Text> : null}
            </>
          ) : (
            <Text style={s.muted}>no answers yet</Text>
          )}
        </Section>

        {data.engines.length ? (
          <Section title={h.engines} accent={data.accent}>
            {data.engines.map((e) => (
              <Row key={e.label} left={e.label} right={e.text} />
            ))}
          </Section>
        ) : null}

        {data.competitors.length ? (
          <Section title={h.competitors} accent={data.accent}>
            {data.competitors.map((c) => (
              <Row key={c.name} left={c.you ? `${c.name} (you)` : c.name} right={c.text} />
            ))}
          </Section>
        ) : null}

        {data.sources.length ? (
          <Section title={h.sources} accent={data.accent}>
            {data.sources.map((x) => (
              <Row
                key={x.domain}
                left={`${x.domain} (${x.category})`}
                right={`${x.links} ${x.links === 1 ? "link" : "links"}`}
              />
            ))}
          </Section>
        ) : null}

        {data.fixes.length ? (
          <Section title={h.fixes} accent={data.accent}>
            {data.fixes.map((f) => (
              <View key={f.title} style={{ marginBottom: 4 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{f.title}</Text>
                {f.detail ? <Text>{f.detail}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {data.weekly.length ? (
          <Section title={h.weekly} accent={data.accent}>
            {data.weekly.map((w) => (
              <Row key={w.date} left={w.date} right={w.text} />
            ))}
          </Section>
        ) : null}

        <Text style={s.footer} fixed>
          {footer}
        </Text>
      </Page>
    </Document>
  );
}

export const renderReportPdf = (data: ReportData) => renderToBuffer(<ReportDocument data={data} />);
