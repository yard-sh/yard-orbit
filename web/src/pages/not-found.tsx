import { SearchXIcon } from "lucide-react";
import { Link } from "react-router";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function NotFound({ what = "page", back = "/" }: { what?: string; back?: string }) {
  return (
    <Page>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No such {what}</EmptyTitle>
          <EmptyDescription>It may have been deleted, or it belongs to another workspace.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to={back}>Go back</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Page>
  );
}
