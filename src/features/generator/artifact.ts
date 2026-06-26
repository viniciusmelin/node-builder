import type { FileTreeItem } from "@/components/TerminalPreview";

export type GeneratedFile = {
  path: string;
  content: string;
};

export const flattenFileTree = (
  items: FileTreeItem[],
  parentPath = ""
): GeneratedFile[] =>
  items.flatMap((item) => {
    const path = parentPath ? `${parentPath}/${item.name}` : item.name;

    if (item.isFolder) {
      return flattenFileTree(item.children ?? [], path);
    }

    return [{ path, content: item.codePreview ?? "" }];
  });

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum = crc32Table[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
};

const concatBytes = (parts: Uint8Array[]) => {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
};

const createHeader = (length: number) => {
  const bytes = new Uint8Array(length);
  return { bytes, view: new DataView(bytes.buffer) };
};

export const createZipBytes = (files: GeneratedFile[]) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path.replace(/^\/+/, ""));
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const local = createHeader(30);

    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    localParts.push(local.bytes, name, data);

    const central = createHeader(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, localOffset, true);
    centralParts.push(central.bytes, name);

    localOffset += local.bytes.length + name.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = createHeader(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralDirectory.length, true);
  end.view.setUint32(16, localOffset, true);

  return concatBytes([...localParts, centralDirectory, end.bytes]);
};

export const createZipBlob = (files: GeneratedFile[]) =>
  new Blob([createZipBytes(files)], { type: "application/zip" });
