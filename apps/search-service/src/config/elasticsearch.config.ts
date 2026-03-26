export interface ElasticsearchConfig {
  node: string;
  indexName: string;
}

export const elasticsearchConfig = (): ElasticsearchConfig => ({
  node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
  indexName: process.env.ELASTICSEARCH_INDEX ?? 'transactions',
});
