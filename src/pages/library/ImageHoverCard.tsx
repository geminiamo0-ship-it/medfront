interface ImageHoverCardProps {
  data: { imgSrc: string; title: string; left: number; top: number };
  onOpenViewer: (imgSrc: string, title: string) => void;
}

export function ImageHoverCard({ data, onOpenViewer }: ImageHoverCardProps) {
  return (
    <div
      id="amboss-img-hover-card"
      style={{ display: 'block', left: data.left, top: data.top }}
    >
      <img
        id="aih-img"
        src={data.imgSrc}
        alt="Thumbnail"
        onClick={() => onOpenViewer(data.imgSrc, data.title)}
      />
      <div id="aih-caption" className="hover-caption">
        {data.title}
      </div>
    </div>
  );
}