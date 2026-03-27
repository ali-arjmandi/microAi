import { SearchDocument, SearchDocumentPatch } from './search-document.model';

export interface MappedSearchUpsert {
  id: string;
  doc: Partial<SearchDocument>;
}

const STATUS_FIELDS: ReadonlyArray<keyof SearchDocument> = [
  'transactionState',
  'searchStatus',
  'aiStatus',
  'moderationStatus',
];

export class DocumentMapper {
  static toUpsert(patch: SearchDocumentPatch): MappedSearchUpsert {
    const id = patch.transactionId.trim();
    if (!id) {
      throw new Error('transactionId is required for deterministic upsert id');
    }

    const nowIso = new Date().toISOString();
    const doc: Partial<SearchDocument> = {
      ...this.cleanPatch(patch),
      transactionId: id,
      updatedAt: nowIso,
    };

    if (!doc.createdAt) {
      doc.createdAt = nowIso;
    }

    if (!doc.searchStatus) {
      const hasBaseTransactionData = Boolean(
        doc.title ||
          doc.propertyAddress ||
          doc.price !== undefined ||
          doc.buyerId ||
          doc.sellerId,
      );
      doc.searchStatus = hasBaseTransactionData ? 'READY' : 'PENDING_BASE';
    }

    if (!doc.transactionState && doc.state) {
      doc.transactionState = doc.state;
    }

    return { id, doc };
  }

  private static cleanPatch(
    patch: SearchDocumentPatch,
  ): Partial<SearchDocument> {
    const next: Partial<SearchDocument> = {};

    for (const [rawKey, rawValue] of Object.entries(patch)) {
      const key = rawKey as keyof SearchDocument;
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      if (typeof rawValue === 'string') {
        if (key === 'price' || key === 'tags') {
          continue;
        }
        const trimmed = rawValue.trim();
        if (!trimmed) {
          continue;
        }
        if (key === 'transactionId') {
          next.transactionId = trimmed;
          continue;
        }
        next[key] = trimmed;
        continue;
      }

      if (Array.isArray(rawValue)) {
        const tags = rawValue
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean);
        if (key === 'tags' && tags.length > 0) {
          next.tags = tags;
        }
        continue;
      }

      if (key === 'price' && typeof rawValue === 'number') {
        next.price = rawValue;
      }
    }

    for (const statusField of STATUS_FIELDS) {
      const value = next[statusField];
      if (typeof value === 'string') {
        const normalized = value.toUpperCase();
        if (statusField === 'transactionState') {
          next.transactionState = normalized;
          continue;
        }
        if (statusField === 'searchStatus') {
          next.searchStatus = normalized;
          continue;
        }
        if (statusField === 'aiStatus') {
          next.aiStatus = normalized;
          continue;
        }
        next.moderationStatus = normalized;
      }
    }

    return next;
  }
}
