import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.badge}>Demo Showcase</span>
        <h1 className={styles.title}>交互式机器学习演示合集</h1>
        <p className={styles.description}>
          这里收集了几个可交互的机器学习/强化学习演示。点击任意卡片即可进入对应场景，
          动手体验模型的训练与推理过程。
        </p>
      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.badge}>Reinforcement Learning</div>
          <h2 className={styles.cardTitle}>MLP 平衡小车-倒立摆</h2>
          <p className={styles.cardText}>
            走进经典的 CartPole 环境，观察多层感知机如何通过策略梯度学习保持杆子竖直。
            页面包含实时物理模拟、奖励曲线以及神经网络权重可视化。
          </p>
          <div className={styles.actions}>
            <Link className={styles.actionLink} href="/cartpole">
              进入演示
            </Link>
          </div>
        </article>

        <article className={styles.card}>
          <div className={`${styles.badge} ${styles.cardBadgeAlt}`}>Coming Soon</div>
          <h2 className={styles.cardTitle}>更多演示占位</h2>
          <p className={styles.cardText}>
            可以在此添加其它机器学习实验，例如卷积神经网络的可视化、生成模型交互等。
            当前仅作为占位提示，方便后续扩展演示目录。
          </p>
          <div className={styles.actions}>
            <span className={styles.placeholder}>敬请期待</span>
          </div>
        </article>
      </section>

      <footer className={styles.footer}>© 2024 交互式演示 · 点击卡片以探索具体实验</footer>
    </main>
  );
}
