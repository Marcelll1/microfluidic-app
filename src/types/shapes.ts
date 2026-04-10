export interface BaseShapeParams {
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotX?: number;
  rotZ?: number;
}

export interface CubeParams extends BaseShapeParams {
  width?: number;
  w?: number;
  height?: number;
  h?: number;
  depth?: number;
  d?: number;
  bevelRadius?: number;
  bevelEdges?: string[];
  bevelGroup?: string;
}

export interface CylinderParams extends BaseShapeParams {
  radius?: number;
  r?: number;
  radiusTop?: number;
  height?: number;
  length?: number;
}

export interface MergedParams extends BaseShapeParams {
  parts?: DbObj[];
}

export type ShapeParams = CubeParams | CylinderParams | MergedParams | Record<string, any>;

export interface DbObj {
  type: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rotation_y?: number | null;
  params?: ShapeParams;
}
