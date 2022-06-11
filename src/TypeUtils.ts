// https://stackoverflow.com/a/71727552/2743204

type IsPositive<N extends number> = `${N}` extends `-${string}` ? false : true;

type IsInteger<N extends number> = `${N}` extends `${string}.${string}`
  ? never
  : `${N}` extends `-${string}.${string}`
  ? never
  : number;

type IsValid<N extends number> = IsPositive<N> extends true
  ? IsInteger<N> extends number
    ? number
    : never
  : never;

type PositiveUint<
  N extends number,
  T extends number[] = []
> = T["length"] extends N ? T[number] : PositiveUint<N, [...T, T["length"]]>;

export type UintRange<N1 extends IsValid<N1>, N2 extends IsValid<N2>> = Exclude<PositiveUint<N2>, PositiveUint<N1>>;


// https://stackoverflow.com/questions/26810574/is-there-a-way-to-create-nominal-types-in-typescript-that-extend-primitive-types/31174747
// declare const IntSymbol: unique symbol;
// export type Int = number & { [IntSymbol]: never };