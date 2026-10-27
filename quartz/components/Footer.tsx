
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"

export default (() => {
  const Footer: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const links = {
  	GitHub: "https://github.com/d3adb3ef",
  	"HackTheBox": "https://profile.hackthebox.com/profile/019c4d59-ac8e-700f-bb06-717c27f2d3a0?utm_medium=copy_url",
  	TryHackMe: "https://tryhackme.com/p/0xd3adbe3f2?utm_campaign=social_share&utm_medium=social&utm_content=profile&cardVersion=8deff65c64c1&utm_source=copy&sharerId=64f8468a6706a07b600c88b0",
  	"Bugcrowd-1": "https://bugcrowd.com/h/RTH",
	"Bugcrowd-2": "https://bugcrowd.com/h/deadbeef_x007",
}

    return (
      <footer class={`${displayClass ?? ""}`}>
        <p>
          Created with strange thing -&gt; just kidding quartz with ❤️ :)
        </p>
        <ul>
          {Object.entries(links).map(([text, link]) => (
            <li key={text}>
              <a href={link} target="_blank" rel="noopener noreferrer">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
