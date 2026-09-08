import { UnifiedTopHeader } from "../UnifiedTopHeader/UnifiedTopHeader";
import { useSearchOverlay } from "../SearchOverlay/SearchOverlayContext";
import { ROUTES, usePrototypeNavigation, type AppRoute } from "../../prototypeRoutes";
import "./PageSkeleton.css";

function Bone({ className = "" }: { className?: string }) {
  return <span className={`page-skeleton__bone ${className}`.trim()} />;
}

function ProductDetailSkeleton() {
  return (
    <div className="page-skeleton__pdp">
      <Bone className="page-skeleton__crumbs" />
      <Bone className="page-skeleton__hero" />
      <div className="page-skeleton__thumbs">
        <Bone className="page-skeleton__thumb" />
        <Bone className="page-skeleton__thumb" />
        <Bone className="page-skeleton__thumb" />
        <Bone className="page-skeleton__thumb" />
      </div>
      <Bone className="page-skeleton__brand" />
      <Bone className="page-skeleton__title" />
      <Bone className="page-skeleton__title page-skeleton__title--short" />
      <Bone className="page-skeleton__price" />
      <Bone className="page-skeleton__cta" />
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div className="page-skeleton__listing">
      <Bone className="page-skeleton__crumbs" />
      <Bone className="page-skeleton__heading" />
      <div className="page-skeleton__filters">
        <Bone className="page-skeleton__filter" />
        <Bone className="page-skeleton__filter" />
        <Bone className="page-skeleton__filter" />
      </div>
      <div className="page-skeleton__grid">
        <span className="page-skeleton__card">
          <Bone className="page-skeleton__card-image" />
          <Bone className="page-skeleton__card-line" />
          <Bone className="page-skeleton__card-line page-skeleton__card-line--short" />
        </span>
        <span className="page-skeleton__card">
          <Bone className="page-skeleton__card-image" />
          <Bone className="page-skeleton__card-line" />
          <Bone className="page-skeleton__card-line page-skeleton__card-line--short" />
        </span>
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="page-skeleton__generic">
      <Bone className="page-skeleton__heading" />
      <Bone className="page-skeleton__hero page-skeleton__hero--short" />
      <Bone className="page-skeleton__title" />
      <Bone className="page-skeleton__title page-skeleton__title--short" />
      <Bone className="page-skeleton__cta" />
    </div>
  );
}

export function PageSkeleton({ route }: { route: AppRoute }) {
  const { navigate } = usePrototypeNavigation();
  const { openSearchOverlay } = useSearchOverlay();

  return (
    <div className="page-skeleton" aria-busy="true">
      <UnifiedTopHeader navigate={navigate} openSearchOverlay={openSearchOverlay} />
      <div className="page-skeleton__body" role="status" aria-live="polite">
        <span className="page-skeleton__sr">Loading page</span>
        {route === ROUTES.productDetail ? (
          <ProductDetailSkeleton />
        ) : route === ROUTES.productListing || route === ROUTES.home ? (
          <ListingSkeleton />
        ) : (
          <GenericSkeleton />
        )}
      </div>
    </div>
  );
}

export default PageSkeleton;
