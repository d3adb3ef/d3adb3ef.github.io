import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default (() => {
  const ProfileCard: QuartzComponent = (_props: QuartzComponentProps) => {
    return (
      <div class="sidebar-profile">
        <img class="sidebar-avatar" src="/static/uwp5000376.jpeg" alt="Profile picture" />
        <div class="sidebar-name"><a href="/">Mahyar's blog</a></div>
        <div class="sidebar-bio">
          CTF writeups, hacking notes, Linux, Windows, and web security. :)
        </div>
      </div>
    )
  }

  ProfileCard.css = `
  .sidebar-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding: 1rem 0 1.25rem;
    text-align: center;
  }

  .sidebar-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .sidebar-name {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--dark);
    line-height: 1.1;
  }

  .sidebar-bio {
    font-size: 0.95rem;
    color: var(--gray);
    line-height: 1.4;
    max-width: 220px;
  }
  `

  return ProfileCard
}) satisfies QuartzComponentConstructor
