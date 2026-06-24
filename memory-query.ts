/**
 * HuntSync AI Memory Query Interface
 * Provides helper functions to access structured memory data
 */

import fs from 'fs/promises';
import path from 'path';

export interface MemoryMetadata {
  name: string;
  version: string;
  createdAt: string;
  lastUpdatedAt: string;
  source: string;
  author: string;
  accessPermissions: string;
  description: string;
}

export interface ProjectOverview {
  name: string;
  description: string;
  repositoryPath: string;
}

export interface TechnologyStack {
  frontend: string[];
  uiFramework: string[];
  backend: string[];
  database: string[];
  backup: string[];
  scraperIntegration: string[];
  deployment: string[];
  buildTool: string[];
  formHandling: string[];
}

export interface Architecture {
  frontendStructure: {
    root: string;
    mainApp: string;
    directories: Record<string, any>;
  };
  backendStructure: {
    mainFile: string;
    responsibilities: string[];
  };
}

export interface KeyFeature {
  id: string;
  name: string;
  purpose: string;
  coreFunctionality?: string[];
  dataFlow?: string[];
  sections?: Array<{
    id: string;
    name: string;
    functionality: string[];
  }>;
}

export interface DataModels {
  d1DatabaseSchema: {
    tables: Array<{
      name: string;
      columns: Array<{ name: string; type: string; primaryKey?: boolean }>;
    }>;
  };
  keyTypeScriptTypes: Record<string, { properties: string[] }>;
}

export interface ApiRoute {
  method: string;
  path: string;
  description: string;
}

export interface ApiRoutes {
  apifyRoutes: ApiRoute[];
  jobsRoutes: ApiRoute[];
  postsRoutes: ApiRoute[];
  configRoutes: ApiRoute[];
  filtersRoutes: ApiRoute[];
  utilityRoutes: ApiRoute[];
}

export interface ApifyIntegration {
  scraperExecutionPattern: string[];
  supportedPlatforms: Array<{
    platform: string;
    actorId: string;
    inputType: string;
  }>;
}

export interface DeploymentEnvironment {
  wranglerConfiguration: any;
  requiredSecrets: string[];
  buildDeployCommands: Array<{ command: string; description: string }>;
}

export interface QuickReference {
  fileLocations: Array<{ name: string; path: string }>;
  keyConstants: {
    defaultKeywords: string[];
    defaultLocations: string[];
    scraperTimeout: string;
    apifyPollInterval: string;
    tokenCacheExpiry: string;
  };
}

export interface MemoryData {
  $schema: string;
  metadata: MemoryMetadata;
  projectOverview: ProjectOverview;
  technologyStack: TechnologyStack;
  architecture: Architecture;
  keyFeatures: KeyFeature[];
  dataModels: DataModels;
  apiRoutes: ApiRoutes;
  apifyIntegration: ApifyIntegration;
  deploymentEnvironment: DeploymentEnvironment;
  criticalPathsAndGotchas: string[];
  quickReference: QuickReference;
}

/**
 * Load the memory from memory.json
 */
export async function loadMemory(memoryPath?: string): Promise<MemoryData> {
  const filePath = memoryPath || path.join(process.cwd(), 'memory.json');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get a feature by its ID
 */
export function getFeature(memory: MemoryData, featureId: string): KeyFeature | undefined {
  return memory.keyFeatures.find(f => f.id === featureId);
}

/**
 * Get all API routes flattened into a single array
 */
export function getAllApiRoutes(memory: MemoryData): ApiRoute[] {
  const { apifyRoutes, jobsRoutes, postsRoutes, configRoutes, filtersRoutes, utilityRoutes } = memory.apiRoutes;
  return [
    ...apifyRoutes,
    ...jobsRoutes,
    ...postsRoutes,
    ...configRoutes,
    ...filtersRoutes,
    ...utilityRoutes
  ];
}

/**
 * Get API routes by category
 */
export function getApiRoutesByCategory(memory: MemoryData, category: keyof ApiRoutes): ApiRoute[] {
  return memory.apiRoutes[category] || [];
}

/**
 * Get supported platforms from Apify integration
 */
export function getSupportedPlatforms(memory: MemoryData): ApifyIntegration['supportedPlatforms'] {
  return memory.apifyIntegration.supportedPlatforms;
}

/**
 * Get quick reference file locations
 */
export function getFileLocations(memory: MemoryData): QuickReference['fileLocations'] {
  return memory.quickReference.fileLocations;
}

/**
 * Get all critical paths and gotchas
 */
export function getCriticalPaths(memory: MemoryData): string[] {
  return memory.criticalPathsAndGotchas;
}
