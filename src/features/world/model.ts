export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  name: string;
  description: string;
  tags: string[];
};
