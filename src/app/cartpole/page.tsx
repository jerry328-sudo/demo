"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "./page.module.css";
import { initCartPole } from "./cartpole-experience";

export default function CartPolePage() {
  useEffect(() => {
    const cleanup = initCartPole();
    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        ← 返回列表
      </Link>

      <h1 className={styles.title}>强化学习演示：MLP 控制小车-倒立摆</h1>

      <section className={styles.layout}>
        <div className={styles.mainColumn}>
          <canvas className={styles.canvas} id="world" />

          <div className={styles.controls}>
            <button className={styles.button} id="startTrain">
              开始训练
            </button>
            <button className={styles.button} id="pauseTrain" disabled>
              暂停训练
            </button>
            <button className={styles.button} id="playBest" disabled>
              回放最佳策略
            </button>
          </div>

          <div className={styles.stats} id="stats">
            Episode: 0
          </div>

          <canvas className={styles.chart} id="rewardChart" />
        </div>

        <aside className={styles.sidePanel}>
          <section className={styles.legend}>
            <strong>演示说明</strong>
            <p>
              - CartPole 环境：目标是在小车上保持杆子竖直。<br />
              - MLP 通过策略梯度进行学习，实时更新网络权重。<br />
              - 奖励曲线展示每回合累计奖励与移动平均值。
            </p>
          </section>

          <section className={styles.network}>
            <strong>网络可视化</strong>
            <canvas className={styles.networkCanvas} id="networkViz" />
          </section>
        </aside>
      </section>
    </main>
  );
}
