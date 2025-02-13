# タンク見積アプリStep2 GraphQLサーバー

## スキーマのExport
`npx postgraphile -c "postgresql://postgres:tankestimate1Pwd@localhost:5432/tankestimate?schema=sales" --schema app --export-schema graphql-schema.graphql`
