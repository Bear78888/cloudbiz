import { ImageResponse } from "next/og";

export const alt = "SellerRelay Logistics — U.S. prep and logistics for international sellers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "72px", color: "white", background: "linear-gradient(135deg,#071025,#102450 65%,#107c74)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "760px" }}>
        <div style={{ display: "flex", fontSize: 24, color: "#76e6d9", letterSpacing: 4, fontWeight: 700 }}>CALIFORNIA-BASED PREP & LOGISTICS</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 70, lineHeight: 1.02, letterSpacing: -4, fontWeight: 800 }}>Your U.S. inventory team</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, lineHeight: 1.4, color: "#d2dced" }}>Receiving · Inspection · FNSKU · Packaging · Storage · FBA Forwarding</div>
        <div style={{ display: "flex", marginTop: 38, fontSize: 26, fontWeight: 800 }}>SellerRelay Logistics</div>
      </div>
      <div style={{ width: 280, height: 280, display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid #18b8a4", borderRadius: 52, transform: "rotate(8deg)", background: "rgba(255,255,255,.06)", fontSize: 95, fontWeight: 900, color: "#76e6d9" }}>SR</div>
    </div>,
    size,
  );
}
