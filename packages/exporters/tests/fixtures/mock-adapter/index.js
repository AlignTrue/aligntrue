export class MockAdapterExporter {
  constructor() {
    this.name = "mock-adapter";
    this.version = "2.0.0";
  }
  async export(_request, _options) {
    return {
      success: true,
      filesWritten: [".mock/test.txt"],
      contentHash: "mock-hash",
      fidelityNotes: ["Mock adapter loaded successfully"],
    };
  }
}
export default MockAdapterExporter;
