import { initializeApollo } from "../lib/apollo";
import Layout from "../components/Layout";
import Submit from "../components/Submit";
import PostList, {
  ALL_POSTS_QUERY,
  allPostsQueryVars,
} from "../components/PostList";

const ApolloPage = () => (
  <Layout>
    <Submit />
    <PostList />
  </Layout>
);

export async function getStaticProps() {
  const apolloClient = initializeApollo();

  try {
    await apolloClient.query({
      query: ALL_POSTS_QUERY,
      variables: allPostsQueryVars,
    });
  } catch (_) {
    // If the API is unavailable, fall back to an empty initial state.
    // The PostList component will surface the error via its own useQuery call.
  }

  return {
    props: {
      initialApolloState: apolloClient.cache.extract(),
    },
    revalidate: 1,
  };
}

export default ApolloPage;
