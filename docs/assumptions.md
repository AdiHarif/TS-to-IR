# Assumptions.

Our compiler does'nt support all TypeScripts features (yet...), therefore there are several conditions the input code must follow (or assumptions we make about the code) in order for it to be compiled properly.

This document describes all the assumptions we make about the input code, by different categories.

## Functions:
1. No function overloading is allowed.
1. All function arguments are required (not optional).
1. No anonymous functions are allowed

## Classes:
1. Classes must be named.
1. Class members contain only properties (fields), non-static methods and a single constructor.
1. No inheritance is allowed.
1. All object properties are initialized in the constructor

## Types:
1. No union\intersection types are allowed.
1. There are no variables of type boolean.

## Expressions:
1. Boolean expression are all simple binary expression (i.e. no boolean operators like 'and'\'or').
1. There is no use of boolean constants (true\false).

## Misc:
1. No global variables.
1. There is no use of instanceof\typeof operators.