/**
 * Extrae la fecha de captura (DateTime) de los metadatos EXIF de una imagen JPEG
 * @param file - Archivo de imagen
 * @returns Promesa que resuelve con la fecha en formato "YYYY-MM-DD" o null
 */
export const extractExifDate = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    // Verificar que sea una imagen
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const view = new DataView(data);

        // Verificar que es un JPEG (comienza con 0xFFD8)
        if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) {
          console.log('No es un JPEG válido');
          resolve(null);
          return;
        }

        let offset = 2;
        const maxOffset = Math.min(view.byteLength, 1000000); // Limitar búsqueda a 1MB

        while (offset < maxOffset - 2) {
          // Buscar marcadores JPEG (comienzan con 0xFF)
          if (view.getUint8(offset) !== 0xFF) {
            offset++;
            continue;
          }

          const marker = view.getUint8(offset + 1);

          // 0xE1 = APP1 (donde va el EXIF)
          if (marker === 0xE1) {
            const segmentLength = view.getUint16(offset + 2, false);

            // Verificar firma "Exif\0\0"
            if (
              view.getUint8(offset + 4) === 0x45 && // E
              view.getUint8(offset + 5) === 0x78 && // x
              view.getUint8(offset + 6) === 0x69 && // i
              view.getUint8(offset + 7) === 0x66 && // f
              view.getUint8(offset + 8) === 0x00 &&
              view.getUint8(offset + 9) === 0x00
            ) {
              const exifDataStart = offset + 10;

              // Leer byte order (0x4949 = little endian, 0x4D4D = big endian)
              const byteOrder = view.getUint16(exifDataStart, false);
              const littleEndian = byteOrder === 0x4949;

              // Verificar TIFF magic number (42)
              const tiffMagic = view.getUint16(exifDataStart + 2, littleEndian);
              if (tiffMagic !== 42) {
                console.log('No es TIFF válido');
                resolve(null);
                return;
              }

              // Leer offset del primer IFD (Image File Directory)
              const ifdOffset = view.getUint32(exifDataStart + 4, littleEndian);
              const ifdStart = exifDataStart + ifdOffset;

              // Leer número de tags en el IFD
              const entryCount = view.getUint16(ifdStart, littleEndian);

              // Buscar el tag DateTime (0x0132 en hex)
              for (let i = 0; i < entryCount; i++) {
                const entryOffset = ifdStart + 2 + i * 12;
                const tag = view.getUint16(entryOffset, littleEndian);
                const type = view.getUint16(entryOffset + 2, littleEndian);
                const count = view.getUint32(entryOffset + 4, littleEndian);
                const valueOffset = view.getUint32(entryOffset + 8, littleEndian);

                // Tag 0x0132 = DateTime
                if (tag === 0x0132 && type === 2) {
                  // Type 2 = ASCII string
                  const stringStart = exifDataStart + valueOffset;
                  let dateTimeStr = '';

                  for (let j = 0; j < Math.min(count - 1, 19); j++) {
                    const charCode = view.getUint8(stringStart + j);
                    if (charCode === 0) break;
                    dateTimeStr += String.fromCharCode(charCode);
                  }

                  // Formato esperado: "YYYY:MM:DD HH:MM:SS"
                  if (dateTimeStr.length >= 10) {
                    const dateOnly = dateTimeStr.substring(0, 10).replace(/:/g, '-');
                    // Validar que sea una fecha válida
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
                      console.log('DateTime EXIF extraído:', dateOnly);
                      resolve(dateOnly);
                      return;
                    }
                  }
                }
              }
            }

            // Saltar este segmento
            offset += segmentLength + 2;
          } else if (marker === 0xD9) {
            // EOI (End of Image) - hemos llegado al final sin encontrar EXIF
            break;
          } else {
            // Saltar a siguiente segmento
            if (offset + 3 < view.byteLength) {
              const segmentLength = view.getUint16(offset + 2, false);
              offset += segmentLength + 2;
            } else {
              break;
            }
          }
        }

        console.log('No se encontró DateTime en EXIF');
        resolve(null);
      } catch (error) {
        console.error('Error extrayendo EXIF:', error);
        resolve(null);
      }
    };

    reader.onerror = () => {
      console.error('Error leyendo archivo');
      resolve(null);
    };

    reader.readAsArrayBuffer(file);
  });
};
