import PDFDocument from "pdfkit";
import BlobStream from "blob-stream";

/*
  Utility class for incremental pdf generation over the course of a user session


*/
export class PDFSession {

    // required
    private pdf: PDFKit.PDFDocument
    private stream: ReturnType<typeof BlobStream>;
    private url: string | null = null;

    private 

    constructor() {
        this.pdf = new PDFDocument({ size: "A4", margin: 50 });
        this.stream = this.pdf.pipe(BlobStream());
    }
}