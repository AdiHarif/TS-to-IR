# Vector2D Requirements

This doc describes what is required from the compiler in order to compile Vector2D module form Fireworks project.
Source code for this module (i.e. what we want to compile) can be found in res/Fireworks/src/Vector2D.ts

## Feature Support

There are several TypeScript language features that are being used in Vector2D module.
Features used that are currently supported by the compiler (at least partially):
1. If statements (with simple boolean conditions)
1. Basic arithmetic operations
1. Function calls

Features that are currently not supported at all:
1. Classes and objects
1. Member functions
1. Library functions (in this case from Math library)
1. Dynamically allocated memory (with 'new' keyword)

## AST Nodes

In order to compile the Vector2D module the compiler is required to support the following AST node kinds (as declared in lib/typescript.d.ts under typescript repo):
* SourceFile
* ClassDeclaration
* ExportKeyword
* Identifier
* PropertyDeclaration
* PublicKeyword
* NumberKeyword
* Constructor
* Parameter
* Block
* ExpressionStatement
* BinaryExpression
* PropertyAccessExpression
* ThisKeyword
* FirstAssignment
* MethodDeclaration
* TypeReference
* ReturnStatement
* NewExpression
* CallExpression
* ParenthesizedExpression
* AsteriskToken
* PlusToken
* VoidKeyword
* FirstStatement
* VariableDeclarationList
* VariableDeclaration
* SlashToken
* FirstCompoundAssignment
* MinusEqualsToken
* MinusToken
* AsteriskEqualsToken
* SlashEqualsToken
* PrefixUnaryExpression
* BooleanKeyword
* EqualsEqualsToken
* FirstLiteralToken
* IfStatement
* GreaterThanToken
* FirstBinaryOperator
* GreaterThanEqualsToken
* EndOfFileToken

## Bindings

After we manage to compile the module to IR and then wasm, we would want to bind it to the other js files in the Fireworks project for it to work. for now the bindings will be created manually after the module is compiled separately from the other files.