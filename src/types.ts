export interface PositionRef {
  readonly line: number;
  readonly column: number;
}

export interface Position {
  readonly start: PositionRef;
  readonly end: PositionRef;
}

export interface LinkReference {
  readonly href: string;
  readonly url: URL | null;
  readonly position: Position | null;
}
