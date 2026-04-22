export interface Extractor {
  canHandle(text: string): boolean;
  extract(text: string): any;
}
