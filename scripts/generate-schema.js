// scripts/generate-schema.js
import fs from 'fs';
import pkg from '@prisma/sdk';
const { getDMMF } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateGraphQLSchema() {
  try {
    // Prismaスキーマの読み込み
    const schemaPath = join(__dirname, '../prisma/schema.prisma');
    const prismaSchema = fs.readFileSync(schemaPath, 'utf-8');
    const dmmf = await getDMMF({ datamodel: prismaSchema });

    let schema = '';

    // スカラー型の定義
    schema += `scalar DateTime\n\n`;

    // 列挙型の定義
    dmmf.datamodel.enums.forEach(enumType => {
      schema += `enum ${enumType.name} {\n`;
      enumType.values.forEach(value => {
        schema += `  ${value.name}\n`;
      });
      schema += `}\n\n`;
    });

    // モデル型の定義
    dmmf.datamodel.models.forEach(model => {
      schema += `type ${model.name} {\n`;
      model.fields.forEach(field => {
        const fieldType = mapPrismaTypeToGraphQL(field);
        const required = field.isRequired ? '!' : '';
        const isList = field.isList ? '[' : '';
        const isListEnd = field.isList ? ']' : '';
        schema += `  ${field.name}: ${isList}${fieldType}${isListEnd}${required}\n`;
      });
      schema += `}\n\n`;
    });

    // Input型の定義
    dmmf.datamodel.models.forEach(model => {
      // Create Input
      schema += `input ${model.name}CreateInput {\n`;
      model.fields
        .filter(field => !field.isId && !field.isReadOnly)
        .forEach(field => {
          const fieldType = mapPrismaTypeToGraphQL(field);
          const isList = field.isList ? '[' : '';
          const isListEnd = field.isList ? ']' : '';
          schema += `  ${field.name}: ${isList}${fieldType}${isListEnd}\n`;
        });
      schema += `}\n\n`;

      // Update Input
      schema += `input ${model.name}UpdateInput {\n`;
      model.fields
        .filter(field => !field.isId && !field.isReadOnly)
        .forEach(field => {
          const fieldType = mapPrismaTypeToGraphQL(field);
          const isList = field.isList ? '[' : '';
          const isListEnd = field.isList ? ']' : '';
          schema += `  ${field.name}: ${isList}${fieldType}${isListEnd}\n`;
        });
      schema += `}\n\n`;

      // Where Unique Input
      schema += `input ${model.name}WhereUniqueInput {\n`;
      model.fields
        .filter(field => field.isId || field.isUnique)
        .forEach(field => {
          const fieldType = mapPrismaTypeToGraphQL(field);
          schema += `  ${field.name}: ${fieldType}\n`;
        });
      schema += `}\n\n`;
    });

    // Query型の定義
    schema += `type Query {\n`;
    dmmf.datamodel.models.forEach(model => {
      const modelName = model.name.toLowerCase();
      schema += `  ${modelName}(where: ${model.name}WhereUniqueInput!): ${model.name}\n`;
      schema += `  ${modelName}s: [${model.name}!]!\n`;
    });
    schema += `}\n\n`;

    // Mutation型の定義
    schema += `type Mutation {\n`;
    dmmf.datamodel.models.forEach(model => {
      const modelName = model.name;
      schema += `  create${modelName}(data: ${modelName}CreateInput!): ${modelName}!\n`;
      schema += `  update${modelName}(where: ${modelName}WhereUniqueInput!, data: ${modelName}UpdateInput!): ${modelName}!\n`;
      schema += `  delete${modelName}(where: ${modelName}WhereUniqueInput!): ${modelName}\n`;
    });
    schema += `}\n`;

    // スキーマファイルの書き出し
    const outputPath = join(__dirname, '../schema.graphql');
    fs.writeFileSync(outputPath, schema);
    console.log('GraphQL schema generated successfully!');
  } catch (error) {
    console.error('Error generating schema:', error);
    process.exit(1);
  }
}

function mapPrismaTypeToGraphQL(field) {
  const typeMapping = {
    'Int': 'Int',
    'BigInt': 'Int',
    'Float': 'Float',
    'Decimal': 'Float',
    'String': 'String',
    'Boolean': 'Boolean',
    'DateTime': 'DateTime',
    'Json': 'JSON',
  };

  if (field.kind === 'object') {
    return field.type;
  }

  return typeMapping[field.type] || 'String';
}

generateGraphQLSchema();