import { HttpError } from '../env';
import type { DesignProvider, IntegrationAdapter } from './adapter';
import { DESIGN_PROVIDERS } from './adapter';
import { figmaAdapter } from './figma';
import { canvaAdapter } from './canva';

const REGISTRY: Record<DesignProvider, IntegrationAdapter> = { figma: figmaAdapter, canva: canvaAdapter };

export const isDesignProvider = (v: unknown): v is DesignProvider => typeof v === 'string' && (DESIGN_PROVIDERS as string[]).includes(v);

export function adapterFor(provider: unknown): IntegrationAdapter {
  if (!isDesignProvider(provider)) throw new HttpError(404, 'Unknown integration');
  return REGISTRY[provider];
}
