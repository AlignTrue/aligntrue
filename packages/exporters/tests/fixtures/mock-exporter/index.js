export class MockExporterExporter {
  constructor() {
    this.name = "mock-exporter";
    this.version = "2.0.0";
  }
  async export(_request, _options) {
    return {
      success: true,
      filesWritten: [".mock/test.txt"],
      contentHash: "mock-hash",
      fidelityNotes: ["Mock exporter loaded successfully"],
    };
  }
}
export default MockExporterExporter;
