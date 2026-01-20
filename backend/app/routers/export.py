from fastapi import APIRouter
from fastapi.responses import FileResponse
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
import tempfile
from datetime import datetime

router = APIRouter(prefix="/api/export", tags=["Export"])

@router.post("/pdf")
def export_pdf(payload: dict):
    data = payload["simulationData"]

    # Create temp PDF file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")

    # PDF document with metadata 
    doc = SimpleDocTemplate(
        temp_file.name,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50,
        title="EcoTwin-AI Sustainability Report",
        author="EcoTwin-AI Platform"
    )

    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            fontSize=20,
            spaceAfter=20,
            leading=24,
            alignment=1  
        )
    )

    styles.add(
        ParagraphStyle(
            name="SectionHeader",
            fontSize=14,
            spaceBefore=16,
            spaceAfter=10,
            leading=18,
            fontName="Helvetica-Bold"
        )
    )

    styles.add(
        ParagraphStyle(
            name="Body",
            fontSize=11,
            leading=16,
            spaceAfter=12
        )
    )

    story = []

    # title
    story.append(Paragraph("EcoTwin-AI Sustainability Report", styles["ReportTitle"]))
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%d %B %Y, %H:%M')}",
        styles["Body"]
    ))

    # context
    story.append(Paragraph("Study Area & Intervention Overview", styles["SectionHeader"]))

    overview_text = (
        f"This report presents the results of an urban sustainability simulation "
        f"conducted for <b>{data['wardName']}</b>. The analysis evaluates the impact "
        f"of a <b>{data['intervention']}</b> strategy applied at an intensity of "
        f"<b>{data['intensity']}%</b>, with the objective of mitigating Urban Heat "
        f"Island (UHI) effects and improving environmental performance."
    )

    story.append(Paragraph(overview_text, styles["Body"]))

    # thermal impact
    story.append(Paragraph("Thermal Impact Assessment", styles["SectionHeader"]))

    thermal_text = (
        f"The simulation predicts an overall surface temperature reduction of "
        f"<b>{data['temperatureReduction']:.2f}°C</b>. As a result, the land surface "
        f"temperature is expected to decrease from <b>{data['lstBefore']:.2f}°C</b> "
        f"to <b>{data['lstAfter']:.2f}°C</b>. This reduction indicates a meaningful "
        f"alleviation of thermal stress within the selected ward."
    )

    story.append(Paragraph(thermal_text, styles["Body"]))

    # vegetation and risk
    story.append(Paragraph("Vegetation Health & Risk Evaluation", styles["SectionHeader"]))

    vegetation_text = (
        f"Vegetation health, assessed using the Normalized Difference Vegetation Index (NDVI), "
        f"shows a significant improvement from <b>{data['ndviBefore']:.3f}</b> to "
        f"<b>{data['ndviAfter']:.3f}</b>. This increase reflects enhanced green cover "
        f"and improved ecological conditions. Correspondingly, the urban heat risk "
        f"level transitions from <b>{data['risk_before']}</b> risk to "
        f"<b>{data['risk_after']}</b> risk, demonstrating the effectiveness of the "
        f"proposed intervention."
    )

    story.append(Paragraph(vegetation_text, styles["Body"]))

    # carbon impact
    story.append(Paragraph("Carbon Offset & Environmental Benefits", styles["SectionHeader"]))

    carbon_text = (
        f"From a climate mitigation perspective, the intervention is estimated to "
        f"offset approximately <b>{data['co2Offset']} tonnes of Carbondioxide per year</b>. "
        f"This contribution supports long-term sustainability goals by reducing "
        f"greenhouse gas concentrations and promoting climate-resilient urban design."
    )

    story.append(Paragraph(carbon_text, styles["Body"]))

    # material intervention
    if data.get("selectedMaterial"):
        story.append(Paragraph("Material-Based Intervention Impact", styles["SectionHeader"]))

        material_text = (
            f"The application of <b>{data['selectedMaterial'].get('name', 'the selected material')}</b> "
            f"provides an additional cooling benefit of approximately "
            f"<b>{data.get('materialCooling', 0):.2f}°C</b>. Furthermore, this material "
            f"intervention contributes a one-time carbon offset of "
            f"<b>{data.get('materialCO2', 0)} tonnes of Carbondioxide</b>, strengthening the "
            f"overall environmental impact of the strategy."
        )

        story.append(Paragraph(material_text, styles["Body"]))

    # build pdf
    doc.build(story)

    return FileResponse(
        temp_file.name,
        media_type="application/pdf",
        filename="EcoTwin_Sustainability_Report.pdf"
    )
